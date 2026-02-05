/**
 * Update Task API Route
 *
 * Updates task state and handles phase transitions.
 * When a task moves to "done" phase, its worktree is NOT automatically deleted
 * (user may need it for PR/MR review). Manual cleanup is available via the
 * worktree API endpoint.
 *
 * Phase transitions: In Progress and AI Review are one-way states. Tasks cannot
 * be moved backwards to them from later phases (use Planning/Replanning instead).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTaskPersistence } from '@/lib/tasks/persistence';
import { getProjectDir } from '@/lib/project-dir';
import { releaseOrchestratorLock } from '@/lib/agents/orchestrator-lock';
import type { WorkflowPhase } from '@/lib/tasks/schema';

const FORBIDDEN_TRANSITIONS: Array<{ from: WorkflowPhase; to: WorkflowPhase }> = [
  { from: 'ai_review', to: 'in_progress' },
  { from: 'done', to: 'ai_review' },
  { from: 'done', to: 'in_progress' },
  { from: 'human_review', to: 'ai_review' },
  { from: 'human_review', to: 'in_progress' },
];

function isPhaseTransitionAllowed(from: WorkflowPhase, to: WorkflowPhase): boolean {
  return !FORBIDDEN_TRANSITIONS.some((t) => t.from === from && t.to === to);
}

export async function PATCH(req: NextRequest) {
  try {
    const projectDir = await getProjectDir(req);
    const taskPersistence = getTaskPersistence(projectDir);
    const body = await req.json();
    const { taskId, updates } = body;

    if (!taskId) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
    }

    const task = await taskPersistence.loadTask(taskId);
    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Support both { taskId, ...updates } and { taskId, updates: {...} } formats
    const actualUpdates = updates || body;

    if (
      typeof actualUpdates.phase === 'string' &&
      actualUpdates.phase !== task.phase &&
      !isPhaseTransitionAllowed(task.phase, actualUpdates.phase as WorkflowPhase)
    ) {
      return NextResponse.json(
        {
          error:
            'Cannot move task backwards to In Progress or AI Review. Use Planning or Replanning to redo work.',
        },
        { status: 400 }
      );
    }

    // Handle pausing orchestrator (when assignedAgent is explicitly cleared)
    if ('assignedAgent' in actualUpdates && actualUpdates.assignedAgent === null) {
      console.log(`[Task ${taskId}] Pausing orchestrator - resetting in_progress subtasks`);

      // Reset any in_progress subtasks to pending
      let resetCount = 0;
      if (task.subtasks) {
        for (const subtask of task.subtasks) {
          if (subtask.status === 'in_progress') {
            subtask.status = 'pending';
            resetCount++;
          }
        }
      }

      // Release orchestrator lock
      releaseOrchestratorLock(taskId);

      console.log(`[Task ${taskId}] Reset ${resetCount} in_progress subtask(s) to pending`);
    }

    // Update task
    const updatedTask = {
      ...task,
      ...actualUpdates,
      updatedAt: Date.now(),
    };

    await taskPersistence.saveTask(updatedTask);

    // Handle phase transitions
    // Note: We don't auto-delete worktrees on completion because user may need
    // them for PR/MR review. Worktree cleanup is manual via /api/git/worktree endpoint.
    if (updates.phase === 'done' && task.phase !== 'done' && task.worktreePath) {
      console.log(
        `[Task ${taskId}] Transitioned to done. Worktree preserved at ${task.worktreePath}`
      );
    }

    return NextResponse.json(updatedTask);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
