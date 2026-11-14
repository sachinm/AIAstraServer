/**
 * GraphQL Query Armor (`SEC-05`), Error Masking (`SEC-06`), and Dual-Plane Observability (`app_error_events`):
 * - Enforces AST max depth, max aliases, max selections, and introspection controls via `src/config/env.ts`.
 * - Preserves allowlisted consumer domain error codes (`UNAUTHENTICATED`, `FORBIDDEN`, `ACCOUNT_LOCKED`, `AUTH_UNAVAILABLE`,
 *   `DEPTH_LIMIT_EXCEEDED`, `ALIAS_LIMIT_EXCEEDED`, `SELECTION_LIMIT_EXCEEDED`, `INTROSPECTION_DISABLED`, `BAD_USER_INPUT`).
 * - Masks unexpected internal/Prisma errors on consumer wire responses with `requestId` correlation while writing
 *   unmasked (PII-redacted) error details and stack previews into `app_error_events` for Admin debugging.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import type express from 'express';
import {
  GraphQLError,
  Kind,
  type DocumentNode,
  type FragmentDefinitionNode,
  type OperationDefinitionNode,
  type SelectionSetNode,
  type ValidationContext,
} from 'graphql';
import type { Plugin } from 'graphql-yoga';
import type { PrismaClient } from '@prisma/client';
import {
  getGraphqlMaxAliases,
  getGraphqlMaxDepth,
  getGraphqlMaxSelections,
  isGraphqlErrorMaskingEnabled,
  isGraphqlIntrospectionEnabled,
} from '../config/env.js';
import { factsFromExpress, factsFromFetch, recordAccountEvent } from '../audit/accountEvents.js';
import { AUTH_UNAVAILABLE_CODE, AUTH_UNAVAILABLE_MESSAGE } from '../auth/requestAuth.js';
import { extractRequestIdFromReq, extractRequestIp, recordAppError } from '../telemetry/appErrors.js';
import { graphqlLogFields } from '../lib/logRedact.js';

export interface GraphqlObsContext {
  requestId: string | null;
  sessionId: string | null;
  page: string | null;
  operationName: string | null;
  userId: string | null;
  ip: string | null;
  userAgent: string | null;
  loggedArmorError?: boolean;
  expressReq?: express.Request;
  fetchReq?: Request;
}

const graphqlObsStorage = new AsyncLocalStorage<GraphqlObsContext>();
const requestObsMap = new WeakMap<Request, GraphqlObsContext>();

export function getGraphqlObsMeta(): GraphqlObsContext | undefined {
  return graphqlObsStorage.getStore();
}

function resolveObsMeta(request?: Request): GraphqlObsContext | undefined {
  return graphqlObsStorage.getStore() ?? (request ? requestObsMap.get(request) : undefined);
}

function ensureObsMeta(request?: Request, operationName?: string | null): GraphqlObsContext | undefined {
  let meta = resolveObsMeta(request);
  if (!meta && request) {
    meta = {
      requestId: request.headers.get('x-request-id')?.trim() || null,
      sessionId: request.headers.get('x-astra-session')?.trim().slice(0, 64) || null,
      page: request.headers.get('x-astra-page')?.trim().slice(0, 120) || null,
      operationName: operationName ?? null,
      userId: null,
      ip: null,
      userAgent: request.headers.get('user-agent')?.slice(0, 300) || null,
      fetchReq: request,
    };
  }
  if (meta) {
    if (request) {
      requestObsMap.set(request, meta);
      if (!meta.fetchReq) meta.fetchReq = request;
    }
    if (operationName && !meta.operationName) meta.operationName = operationName;
    if (!graphqlObsStorage.getStore()) {
      graphqlObsStorage.enterWith(meta);
    }
  }
  return meta;
}

export function runWithGraphqlObsContext<T>(req: express.Request, fn: () => Promise<T>): Promise<T> {
  const { operationName } = graphqlLogFields(req.body);
  const store: GraphqlObsContext = {
    requestId: extractRequestIdFromReq(req as express.Request & { requestId?: string }),
    sessionId: typeof req.headers['x-astra-session'] === 'string' ? req.headers['x-astra-session'].trim().slice(0, 64) : null,
    page: typeof req.headers['x-astra-page'] === 'string' ? req.headers['x-astra-page'].trim().slice(0, 120) : null,
    operationName,
    userId: null,
    ip: extractRequestIp(req),
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 300) : null,
    expressReq: req,
  };
  return graphqlObsStorage.run(store, fn);
}

export interface GraphqlArmorLimits {
  maxDepth: number;
  maxAliases: number;
  maxSelections: number;
  introspectionEnabled: boolean;
}

export type GraphqlArmorResult =
  | { ok: true; operationName: string | null; depth: number; aliases: number; selections: number }
  | {
      ok: false;
      code: 'INTROSPECTION_DISABLED' | 'DEPTH_LIMIT_EXCEEDED' | 'ALIAS_LIMIT_EXCEEDED' | 'SELECTION_LIMIT_EXCEEDED';
      message: string;
      operationName: string | null;
    };

export function inspectGraphqlDocument(
  document: DocumentNode,
  limits: GraphqlArmorLimits,
  targetOperationName?: string | null
): GraphqlArmorResult {
  const fragments = new Map<string, FragmentDefinitionNode>();
  const ops: OperationDefinitionNode[] = [];
  for (const def of document.definitions) {
    if (def.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(def.name.value, def);
    } else if (def.kind === Kind.OPERATION_DEFINITION) {
      ops.push(def);
    }
  }

  const selectedOps = targetOperationName
    ? ops.filter((o) => o.name?.value === targetOperationName)
    : ops;
  const opsToCheck = selectedOps.length ? selectedOps : ops;
  const firstOpName = opsToCheck[0]?.name?.value ?? targetOperationName ?? null;

  let maxDepth = 0;
  let aliases = 0;
  let selections = 0;
  let hasIntrospection = false;

  const walk = (set: SelectionSetNode, depth: number, stack: Set<string>): void => {
    for (const sel of set.selections) {
      selections += 1;
      if (selections > limits.maxSelections * 4) return;
      if (sel.kind === Kind.FIELD) {
        const fieldName = sel.name.value;
        if (fieldName === '__schema' || fieldName === '__type') {
          hasIntrospection = true;
        }
        if (sel.alias) {
          aliases += 1;
        }
        const fieldDepth = depth + 1;
        if (fieldDepth > maxDepth) maxDepth = fieldDepth;
        if (sel.selectionSet) {
          walk(sel.selectionSet, fieldDepth, stack);
        }
      } else if (sel.kind === Kind.INLINE_FRAGMENT) {
        walk(sel.selectionSet, depth, stack);
      } else if (sel.kind === Kind.FRAGMENT_SPREAD) {
        const fragName = sel.name.value;
        if (stack.has(fragName)) continue;
        const frag = fragments.get(fragName);
        if (frag) {
          stack.add(fragName);
          walk(frag.selectionSet, depth, stack);
          stack.delete(fragName);
        }
      }
    }
  };

  for (const op of opsToCheck) {
    walk(op.selectionSet, 0, new Set<string>());
  }

  if (hasIntrospection) {
    if (!limits.introspectionEnabled) {
      return {
        ok: false,
        code: 'INTROSPECTION_DISABLED',
        message: 'GraphQL introspection is disabled.',
        operationName: firstOpName,
      };
    }
    return { ok: true, operationName: firstOpName, depth: maxDepth, aliases, selections };
  }

  if (aliases > limits.maxAliases) {
    return {
      ok: false,
      code: 'ALIAS_LIMIT_EXCEEDED',
      message: `Query exceeds maximum allowed aliases (${limits.maxAliases}).`,
      operationName: firstOpName,
    };
  }
  if (selections > limits.maxSelections) {
    return {
      ok: false,
      code: 'SELECTION_LIMIT_EXCEEDED',
      message: `Query exceeds maximum allowed field selections (${limits.maxSelections}).`,
      operationName: firstOpName,
    };
  }
  if (maxDepth > limits.maxDepth) {
    return {
      ok: false,
      code: 'DEPTH_LIMIT_EXCEEDED',
      message: `Query exceeds maximum allowed depth (${limits.maxDepth}).`,
      operationName: firstOpName,
    };
  }

  return { ok: true, operationName: firstOpName, depth: maxDepth, aliases, selections };
}

const DOMAIN_ALLOWLIST_CODES = new Set([
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'ACCOUNT_LOCKED',
  AUTH_UNAVAILABLE_CODE,
  'BAD_USER_INPUT',
  'DEPTH_LIMIT_EXCEEDED',
  'ALIAS_LIMIT_EXCEEDED',
  'SELECTION_LIMIT_EXCEEDED',
  'INTROSPECTION_DISABLED',
]);

const ON_RESULT_PASSTHROUGH_CODES = new Set([...DOMAIN_ALLOWLIST_CODES, 'INTERNAL_SERVER_ERROR']);

const ARMOR_CODES = new Set([
  'DEPTH_LIMIT_EXCEEDED',
  'ALIAS_LIMIT_EXCEEDED',
  'SELECTION_LIMIT_EXCEEDED',
  'INTROSPECTION_DISABLED',
]);

function recordBlockedQuery(
  prisma: PrismaClient | undefined,
  meta: GraphqlObsContext | undefined,
  code: string,
  message: string,
  operationName: string | null
): void {
  if (meta) meta.loggedArmorError = true;
  void recordAppError(prisma, {
    source: 'graphql',
    severity: 'warn',
    category: 'graphql_armor',
    errorCode: code,
    statusCode: 400,
    page: meta?.page ?? '/',
    operation: operationName ?? meta?.operationName ?? null,
    message,
    requestId: meta?.requestId ?? null,
    sessionId: meta?.sessionId ?? null,
    userId: meta?.userId ?? null,
    ip: meta?.ip ?? null,
    userAgent: meta?.userAgent ?? null,
  });
  const accModel = (prisma as unknown as { accountEvent?: { create?: unknown } } | undefined)?.accountEvent;
  if (prisma && accModel?.create) {
    void recordAccountEvent(prisma, {
      userId: meta?.userId ?? null,
      action: 'graphql_query_blocked',
      outcome: 'refused',
      note: code,
      request: meta?.expressReq
        ? factsFromExpress(meta.expressReq)
        : meta?.fetchReq
          ? factsFromFetch(meta.fetchReq)
          : undefined,
    });
  }
}

export function graphqlArmorAndObservabilityPlugin(deps: { prisma?: PrismaClient } = {}): Plugin {
  return {
    onParams({ request, params }) {
      ensureObsMeta(request, params.operationName ?? null);
    },
    onContextBuilding({ context }) {
      const ctxReq = (context as { request?: Request } | undefined)?.request;
      const store = ensureObsMeta(ctxReq);
      if (store && ctxReq) {
        if (!store.requestId) store.requestId = ctxReq.headers.get('x-request-id');
        if (!store.sessionId) store.sessionId = ctxReq.headers.get('x-astra-session');
        if (!store.page) store.page = ctxReq.headers.get('x-astra-page');
      }
    },
    onExecute({ args }) {
      const ctx = args.contextValue as { userId?: string | null; requestId?: string | null; request?: Request } | undefined;
      const store = ensureObsMeta(ctx?.request, args.operationName ?? null);
      if (!store) return;
      if (ctx?.userId) store.userId = ctx.userId;
      if (ctx?.requestId) store.requestId = ctx.requestId;
      if (!store.operationName && args.operationName) store.operationName = args.operationName;
    },
    onValidate({ addValidationRule }) {
      addValidationRule((context: ValidationContext) => {
        const meta = resolveObsMeta();
        const res = inspectGraphqlDocument(
          context.getDocument(),
          {
            maxDepth: getGraphqlMaxDepth(),
            maxAliases: getGraphqlMaxAliases(),
            maxSelections: getGraphqlMaxSelections(),
            introspectionEnabled: isGraphqlIntrospectionEnabled(),
          },
          meta?.operationName ?? null
        );
        if (!res.ok) {
          recordBlockedQuery(deps.prisma, meta, res.code, res.message, res.operationName);
          context.reportError(
            new GraphQLError(res.message, {
              extensions: {
                code: res.code,
                http: { status: 400 },
                ...(meta?.requestId ? { requestId: meta.requestId } : {}),
              },
            })
          );
        }
        return {};
      });
    },
    onResultProcess({ request, result, setResult }) {
      const maskingEnabled = isGraphqlErrorMaskingEnabled();
      if (!result || Array.isArray(result) || !('errors' in result) || !Array.isArray(result.errors) || result.errors.length === 0) return;
      const meta = resolveObsMeta(request);
      let changed = false;
      const updated = result.errors.map((err) => {
        const extCode = typeof err.extensions?.code === 'string' ? err.extensions.code : null;
        if (extCode && ON_RESULT_PASSTHROUGH_CODES.has(extCode)) {
          if (meta?.requestId && !err.extensions?.requestId) {
            changed = true;
            return new GraphQLError(err.message, {
              nodes: err.nodes,
              source: err.source,
              positions: err.positions,
              path: err.path,
              originalError: err.originalError,
              extensions: { ...err.extensions, requestId: meta.requestId },
            });
          }
          return err;
        }
        if (!err.originalError) {
          changed = true;
          const sanitizedMsg = maskingEnabled
            ? err.message.replace(/\s*Did you mean [^?]+\?/g, '').trim()
            : err.message;
          void recordAppError(deps.prisma, {
            source: 'graphql',
            severity: 'warn',
            category: 'graphql_validation',
            errorCode: 'GRAPHQL_VALIDATION_FAILED',
            statusCode: 400,
            page: meta?.page ?? '/',
            operation: meta?.operationName ?? null,
            message: sanitizedMsg,
            requestId: meta?.requestId ?? null,
            sessionId: meta?.sessionId ?? null,
            userId: meta?.userId ?? null,
            ip: meta?.ip ?? null,
            userAgent: meta?.userAgent ?? null,
          });
          return new GraphQLError(sanitizedMsg, {
            nodes: err.nodes,
            source: err.source,
            positions: err.positions,
            path: err.path,
            extensions: {
              ...(err.extensions ?? {}),
              code: 'GRAPHQL_VALIDATION_FAILED',
              ...(meta?.requestId ? { requestId: meta.requestId } : {}),
            },
          });
        }
        return err;
      });
      if (changed) {
        setResult({ ...result, errors: updated });
      }
    },
  };
}

function asGraphQLErrorLike(error: unknown): GraphQLError | null {
  if (error instanceof GraphQLError) return error;
  if (
    error &&
    typeof error === 'object' &&
    ((error as { name?: unknown }).name === 'GraphQLError' ||
      'originalError' in error ||
      'positions' in error ||
      ('extensions' in error && 'path' in error))
  ) {
    return error as GraphQLError;
  }
  return null;
}

export function createGraphqlMaskError(deps: { prisma?: PrismaClient } = {}) {
  return (error: unknown, defaultMessage: string, isDev?: boolean): Error => {
    const meta = graphqlObsStorage.getStore();
    const requestId = meta?.requestId ?? null;
    const gqlErr = asGraphQLErrorLike(error);
    const orig = gqlErr?.originalError ?? (error instanceof Error && error !== gqlErr ? error : null);
    const rawMsg = orig?.message || gqlErr?.message || (error instanceof Error ? error.message : String(error ?? ''));
    const rawCode =
      (gqlErr?.extensions?.code as string | undefined) ??
      ((orig as { extensions?: { code?: unknown } } | null)?.extensions?.code as string | undefined) ??
      null;

    // 1. Exact auth/RBAC compatibility (src/graphql/rbac.ts & schema.ts throw plain Error strings)
    if (rawCode === 'UNAUTHENTICATED' || rawMsg === 'Not authenticated') {
      return new GraphQLError('Not authenticated', {
        path: gqlErr?.path,
        extensions: { code: 'UNAUTHENTICATED', ...(requestId ? { requestId } : {}) },
      });
    }

    if (rawCode === 'FORBIDDEN' || /^Forbidden\b/i.test(rawMsg)) {
      void recordAppError(deps.prisma, {
        source: 'rbac',
        severity: 'warn',
        category: 'rbac_denied',
        errorCode: 'FORBIDDEN',
        statusCode: 403,
        page: meta?.page ?? '/',
        operation: meta?.operationName ?? gqlErr?.path?.join('.') ?? null,
        message: rawMsg || 'Forbidden',
        requestId,
        sessionId: meta?.sessionId ?? null,
        userId: meta?.userId ?? null,
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
      });
      const accModel = (deps.prisma as unknown as { accountEvent?: { create?: unknown } } | undefined)?.accountEvent;
      if (deps.prisma && accModel?.create) {
        void recordAccountEvent(deps.prisma, {
          userId: meta?.userId ?? null,
          action: 'rbac_denied',
          outcome: 'refused',
          note: meta?.operationName ?? 'graphql',
          request: meta?.expressReq
            ? factsFromExpress(meta.expressReq)
            : meta?.fetchReq
              ? factsFromFetch(meta.fetchReq)
              : undefined,
        });
      }
      return new GraphQLError(rawMsg || 'Forbidden', {
        path: gqlErr?.path,
        extensions: { code: 'FORBIDDEN', ...(requestId ? { requestId } : {}) },
      });
    }

    if (rawCode === AUTH_UNAVAILABLE_CODE) {
      return new GraphQLError(gqlErr?.message || AUTH_UNAVAILABLE_MESSAGE, {
        path: gqlErr?.path,
        extensions: {
          code: AUTH_UNAVAILABLE_CODE,
          http: { status: 503 },
          ...(requestId ? { requestId } : {}),
        },
      });
    }

    if (rawCode && DOMAIN_ALLOWLIST_CODES.has(rawCode)) {
      if (ARMOR_CODES.has(rawCode) && !meta?.loggedArmorError) {
        recordBlockedQuery(deps.prisma, meta, rawCode, rawMsg, meta?.operationName ?? null);
      }
      return new GraphQLError(gqlErr?.message || rawMsg || defaultMessage, {
        path: gqlErr?.path,
        extensions: { ...(gqlErr?.extensions ?? {}), code: rawCode, ...(requestId ? { requestId } : {}) },
      });
    }

    // 2. Pure GraphQL syntax/validation error without an underlying resolver exception
    const maskingEnabled = isDev === false || isGraphqlErrorMaskingEnabled();
    if (gqlErr && !gqlErr.originalError) {
      const sanitizedMsg = maskingEnabled
        ? gqlErr.message.replace(/\s*Did you mean [^?]+\?/g, '').trim()
        : gqlErr.message;
      void recordAppError(deps.prisma, {
        source: 'graphql',
        severity: 'warn',
        category: 'graphql_validation',
        errorCode: 'GRAPHQL_VALIDATION_FAILED',
        statusCode: 400,
        page: meta?.page ?? '/',
        operation: meta?.operationName ?? null,
        message: sanitizedMsg,
        requestId,
        sessionId: meta?.sessionId ?? null,
        userId: meta?.userId ?? null,
        ip: meta?.ip ?? null,
        userAgent: meta?.userAgent ?? null,
      });
      return new GraphQLError(sanitizedMsg, {
        nodes: gqlErr.nodes,
        source: gqlErr.source,
        positions: gqlErr.positions,
        path: gqlErr.path,
        extensions: {
          ...(gqlErr.extensions ?? {}),
          code: 'GRAPHQL_VALIDATION_FAILED',
          ...(requestId ? { requestId } : {}),
        },
      });
    }

    // 3. Unexpected internal / Prisma / downstream error: log full redacted trace to app_error_events, mask consumer wire
    const internalCode = String(
      (orig as { code?: unknown } | null)?.code ??
        (gqlErr as { code?: unknown } | null)?.code ??
        orig?.name ??
        'INTERNAL_SERVER_ERROR'
    );
    void recordAppError(deps.prisma, {
      source: 'graphql',
      severity: 'error',
      category: 'graphql_resolver',
      errorCode: internalCode,
      statusCode: 500,
      page: meta?.page ?? '/',
      operation: meta?.operationName ?? gqlErr?.path?.join('.') ?? null,
      message: rawMsg || defaultMessage,
      stack: orig?.stack ?? gqlErr?.stack,
      requestId,
      sessionId: meta?.sessionId ?? null,
      userId: meta?.userId ?? null,
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent ?? null,
      meta: { path: gqlErr?.path ?? null },
    });

    if (maskingEnabled) {
      return new GraphQLError('Something went wrong while processing your request.', {
        path: gqlErr?.path,
        extensions: { code: 'INTERNAL_SERVER_ERROR', ...(requestId ? { requestId } : {}) },
      });
    }

    return new GraphQLError(rawMsg || defaultMessage, {
      path: gqlErr?.path,
      extensions: {
        ...(gqlErr?.extensions ?? {}),
        code: rawCode || 'INTERNAL_SERVER_ERROR',
        ...(requestId ? { requestId } : {}),
      },
    });
  };
}
