/**
 * Clean planning artifacts from worktree.
 *
 * Agents may write implementation-plan.json, planning-questions.json, etc.
 * to the worktree during planning. They may also write to ../../scratch/
 * (outside the worktree). These should not appear in the final output.
 * Call this at every transition past planning.
 */

import fs from 'fs/promises';
import path from 'path';

const PLANNING_ARTIFACTS = [
  'implementation-plan.json',
  'implementation_plan.json',
  'planning-questions.json',
  'planning_questions.json',
];

/**
 * Get the scratch directory path (outside worktree).
 * - From worktree project/.code-automata/worktrees/task-xxx → project/.code-automata/scratch
 * - From project root project/ → project/.code-automata/scratch
 */
function getScratchPath(worktreeOrProjectPath: string): string {
  const resolved = path.resolve(worktreeOrProjectPath.trim());
  const parts = resolved.split(path.sep);
  if (parts.includes('.code-automata') && parts.includes('worktrees')) {
    return path.join(path.dirname(path.dirname(resolved)), 'scratch');
  }
  return path.join(resolved, '.code-automata', 'scratch');
}

/**
 * Remove planning artifact files from the worktree and the scratch folder.
 * Safe to call multiple times; ignores missing files.
 *
 * @param worktreePath - Absolute path to the worktree (e.g. .code-automata/worktrees/task-xxx)
 */
export async function cleanPlanningArtifactsFromWorktree(worktreePath: string): Promise<void> {
  if (!worktreePath || typeof worktreePath !== 'string') return;

  const resolved = path.resolve(worktreePath.trim());
  if (!resolved) return;

  for (const basename of PLANNING_ARTIFACTS) {
    try {
      const filePath = path.join(resolved, basename);
      await fs.unlink(filePath);
    } catch (err) {
      const code =
        err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : '';
      if (code !== 'ENOENT') {
        console.warn(`[cleanPlanningArtifacts] Failed to remove ${basename}:`, err);
      }
    }
  }

  // Clean scratch folder (../../scratch relative to worktree - outside worktree)
  try {
    const scratchPath = getScratchPath(worktreePath);
    await fs.rm(scratchPath, { recursive: true, force: true });
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : '';
    if (code !== 'ENOENT') {
      console.warn('[cleanPlanningArtifacts] Failed to remove scratch folder:', err);
    }
  }
}
