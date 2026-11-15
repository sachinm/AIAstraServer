/**
 * Multi-Workspace Locator & Artifact Reader for AIAstra E2E Test Suite
 * Resolves cross-repository artifacts across AIAstra_Server, AIAstra_WEB,
 * aiadastra_admin, and AIAstra_Radha in both standard checkouts and git worktrees.
 *
 * Adheres strictly to the Integrity Mandate: never returns mock fallbacks or
 * tautological passes if an artifact is missing.
 */
import fs from 'node:fs';
import path from 'node:path';

export type WorkspaceRepo = 'AIAstra_WEB' | 'aiadastra_admin' | 'AIAstra_Radha' | 'AIAstra_Server';

export function resolveWorkspacePath(repoName: WorkspaceRepo, subPath = ''): string {
  // 1. Explicit environment variable override (e.g. AIASTRA_WEB_PATH)
  const envVarName = `${repoName.toUpperCase()}_PATH`;
  const envOverride = process.env[envVarName];
  if (envOverride) {
    const candidate = path.resolve(envOverride, subPath);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // 2. Candidate directory roots across local development and worktree layouts
  // Prioritize worktrees where origin/develop and active milestone branches reside
  const candidates: string[] = [
    // Worktree locations first (active Phase 1 / develop worktrees)
    path.resolve(process.cwd(), '..', 'worktrees', `${repoName}_m1`, subPath),
    path.resolve(process.cwd(), '..', 'worktrees', `${repoName}_m2`, subPath),
    path.resolve(process.cwd(), '..', 'worktrees', `${repoName}_m3`, subPath),
    path.resolve(process.cwd(), '..', 'worktrees', `${repoName}_m4`, subPath),
    path.resolve(process.cwd(), '..', 'worktrees', `${repoName}_m5`, subPath),
    path.resolve(process.cwd(), '..', 'worktrees', `${repoName}_e2e`, subPath),
    path.resolve('C:/Users/Owner/Documents/work/worktrees', `${repoName}_m1`, subPath),
    path.resolve('C:/Users/Owner/Documents/work/worktrees', `${repoName}_m2`, subPath),
    path.resolve('C:/Users/Owner/Documents/work/worktrees', `${repoName}_m3`, subPath),
    path.resolve('C:/Users/Owner/Documents/work/worktrees', `${repoName}_m4`, subPath),
    path.resolve('C:/Users/Owner/Documents/work/worktrees', `${repoName}_m5`, subPath),
    path.resolve('C:/Users/Owner/Documents/work/worktrees', `${repoName}_e2e`, subPath),
    // Standard workspace directories
    path.resolve(process.cwd(), '..', repoName, subPath),
    path.resolve('C:/Users/Owner/Documents/work', repoName, subPath),
  ];

  // Special case for monorepos (e.g. aiadastra_admin has web/package.json and api/package.json)
  if (repoName === 'aiadastra_admin' && (subPath === 'package.json' || subPath === '')) {
    candidates.push(
      path.resolve(process.cwd(), '..', repoName, 'web', 'package.json'),
      path.resolve('C:/Users/Owner/Documents/work', repoName, 'web', 'package.json'),
      path.resolve(process.cwd(), '..', repoName, 'api', 'package.json'),
      path.resolve('C:/Users/Owner/Documents/work', repoName, 'api', 'package.json'),
    );
  }

  // If locating within AIAstra_Server itself:
  if (repoName === 'AIAstra_Server') {
    candidates.unshift(path.resolve(process.cwd(), subPath));
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `[workspaceLocator] Artifact '${subPath}' in workspace '${repoName}' was not found.\n` +
    `Checked candidates:\n${candidates.map((c) => `  - ${c}`).join('\n')}`
  );
}

export function workspaceArtifactExists(repoName: WorkspaceRepo, subPath: string): boolean {
  try {
    const resolved = resolveWorkspacePath(repoName, subPath);
    return fs.existsSync(resolved);
  } catch {
    return false;
  }
}

export function readWorkspaceArtifact(repoName: WorkspaceRepo, subPath: string): string {
  const resolved = resolveWorkspacePath(repoName, subPath);
  return fs.readFileSync(resolved, 'utf8');
}
