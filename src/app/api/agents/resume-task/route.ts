/**
 * Resume Task API Route
 *
 * Resumes a stuck task by:
 * 1. Resetting any in_progress subtasks to pending
 * 2. Calling the orchestrator to resume from the last completed subtask
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTaskPersistence } from '@/lib/tasks/persistence';
import { getProjectDir } from '@/lib/project-dir';
import { runDevQALoop } from '@/lib/agents/run-dev-qa-loop';
import { acquireOrchestratorLock, releaseOrchestratorLock } from '@/lib/agents/orchestrator-lock';

export async function POST(req: NextRequest) {
  let taskId: string | undefined;

  try {
    const projectDir = await getProjectDir(req);
    const taskPersistence = getTaskPersistence(projectDir);

    const body = await req.json();
    taskId = body.taskId;

    if (!taskId) {
      return NextResponse.json({ error: 'taskId required' }, { status: 400 });
    }

    // CRITICAL: Acquire in-memory lock FIRST before any file operations
    // This prevents race conditions that file-based checks can't handle
    if (!acquireOrchestratorLock(taskId, 'resuming')) {
      return NextResponse.json(
        { error: 'Orchestrator is already starting/resuming for this task' },
        { status: 409 }
      );
    }

    // Load task
    const task = await taskPersistence.loadTask(taskId);
    if (!task) {
      releaseOrchestratorLock(taskId);
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check if task is in a resumable state
    if (task.phase !== 'in_progress' && task.phase !== 'ai_review') {
      releaseOrchestratorLock(taskId);
      return NextResponse.json(
        { error: 'Task is not in a resumable state (must be in_progress or ai_review)' },
        { status: 400 }
      );
    }

    // Check if orchestrator is already running (has an assigned agent)
    if (task.assignedAgent) {
      releaseOrchestratorLock(taskId);
      return NextResponse.json(
        { error: 'Task orchestrator is already running - cannot resume' },
        { status: 409 }
      );
    }

    // Reset any in_progress subtasks to pending
    // This ensures we re-run subtasks that were interrupted
    let resetCount = 0;
    for (let i = 0; i < task.subtasks.length; i++) {
      if (task.subtasks[i].status === 'in_progress') {
        task.subtasks[i].status = 'pending';
        resetCount++;
      }
    }

    // CRITICAL: Reload task to check for race conditions
    // Multiple resume requests can arrive simultaneously, so we need to check again
    const latestTask = await taskPersistence.loadTask(taskId);
    if (!latestTask) {
      releaseOrchestratorLock(taskId);
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }
    if (latestTask.assignedAgent && latestTask.assignedAgent !== 'resuming') {
      releaseOrchestratorLock(taskId);
      return NextResponse.json(
        { error: 'Another orchestrator started while processing this request' },
        { status: 409 }
      );
    }

    // Set a temporary flag to prevent concurrent resume calls
    // This will be replaced by the actual agent thread ID when the orchestrator starts
    task.assignedAgent = 'resuming';
    task.status = 'in_progress';
    task.updatedAt = Date.now();

    await taskPersistence.saveTask(task);

    // Resume the orchestrator
    // Fire and forget - orchestrator will manage the entire loop and release the lock
    runDevQALoop(taskPersistence, projectDir, taskId).catch((error) => {
      console.error('[Resume Task] Orchestrator error:', error);
      // Clear the flag on error
      taskPersistence.loadTask(taskId).then((t) => {
        if (t && t.assignedAgent === 'resuming') {
          t.assignedAgent = undefined;
          t.status = 'blocked';
          taskPersistence.saveTask(t);
        }
      });
      // Release lock on error
      releaseOrchestratorLock(taskId);
    });

    return NextResponse.json({
      success: true,
      message: `Task resumed (reset ${resetCount} in_progress subtask(s))`,
      resetSubtasks: resetCount,
    });
  } catch (error) {
    // Release lock on any exception
    if (taskId) {
      releaseOrchestratorLock(taskId);
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
