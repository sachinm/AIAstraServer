/**
 * Lock-out for GraphQL (docs/admin/01 §4.1.2).
 *
 * Why a plugin and not a check in each resolver: schema.ts has some 40 resolvers with three different auth styles
 * (requireRoles, withAuth, withAdmin) and some return `{ success: false }` instead of throwing. One `onExecute` hook sees
 * every operation after the context is built and before any resolver runs, so a new resolver cannot forget the check,
 * and nothing in schema.ts changes. It looks only at the operation's root fields: `me` (which reports `locked` so the
 * web can show the locked screen), `logout` and introspection still run; anything else in the operation refuses the
 * whole operation with ACCOUNT_LOCKED.
 */
import { GraphQLError, Kind, type DocumentNode, type FragmentDefinitionNode, type OperationDefinitionNode, type SelectionSetNode } from 'graphql';
import type { Plugin } from 'graphql-yoga';
import { ACCOUNT_LOCKED_CODE } from '../auth/requestAuth.js';

export const LOCKED_ALLOWED_FIELDS: ReadonlySet<string> = new Set(['me', 'logout', '__typename', '__schema', '__type']);

export function lockedError(): GraphQLError {
  return new GraphQLError('Account locked', { extensions: { code: ACCOUNT_LOCKED_CODE } });
}

/** Root field names of the operation that will run, through inline fragments and fragment spreads. */
export function rootFieldNames(document: DocumentNode, operationName?: string | null): string[] {
  const ops = document.definitions.filter((d): d is OperationDefinitionNode => d.kind === Kind.OPERATION_DEFINITION);
  const op = operationName ? ops.find((o) => o.name?.value === operationName) : ops[0];
  if (!op) return [];
  const fragments = new Map(
    document.definitions.filter((d): d is FragmentDefinitionNode => d.kind === Kind.FRAGMENT_DEFINITION).map((f) => [f.name.value, f])
  );
  const names: string[] = [];
  const seen = new Set<string>();
  const walk = (set: SelectionSetNode): void => {
    for (const s of set.selections) {
      if (s.kind === Kind.FIELD) names.push(s.name.value);
      else if (s.kind === Kind.INLINE_FRAGMENT) walk(s.selectionSet);
      else if (s.kind === Kind.FRAGMENT_SPREAD && !seen.has(s.name.value)) {
        seen.add(s.name.value);
        const f = fragments.get(s.name.value);
        if (f) walk(f.selectionSet);
      }
    }
  };
  walk(op.selectionSet);
  return names;
}

export function lockGuardPlugin(): Plugin {
  return {
    onExecute({ args, setResultAndStopExecution }) {
      const ctx = args.contextValue as { locked?: boolean } | undefined;
      if (!ctx?.locked) return;
      if (rootFieldNames(args.document, args.operationName).every((n) => LOCKED_ALLOWED_FIELDS.has(n))) return;
      setResultAndStopExecution({ errors: [lockedError()] });
    },
  };
}
