/**
 * Start AI Review API Route
 *
 * Starts AI review phase:
 * 1. Execute QA subtasks sequentially
 * 2. Update subtask statuses as they complete
 * 3. Transition to completed when all QA subtasks finish
 */

import { NextRequest, NextResponse } from 'next/server';
import { agentManager } from '@/lib/agents/singleton';
import { taskPersistence } from '@/lib/tasks/persistence';
import { Subtask } from '@/lib/tasks/schema';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { taskId } = await req.json();

    if (!taskId) {
      return NextResponse.json(
        { error: 'taskId required' },
        { status: 400 }
      );
    }

    // Load task
    const task = await taskPersistence.loadTask(taskId);
    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    // Check if task is in AI review phase
    if (task.phase !== 'ai_review') {
      return NextResponse.json(
        { error: 'Task must be in ai_review phase' },
        { status: 400 }
      );
    }

    // Check if task has QA subtasks
    const qaSubtasks = task.subtasks.filter(s => s.type === 'qa');
    if (qaSubtasks.length === 0) {
      return NextResponse.json(
        { error: 'No QA subtasks found' },
        { status: 400 }
      );
    }

    // Ensure review logs directory exists
    const logsPath = `.code-auto/tasks/${taskId}/review-logs.txt`;
    const logsDir = path.dirname(logsPath);
    await fs.mkdir(logsDir, { recursive: true });

    // Initialize log file
    await fs.writeFile(
      logsPath,
      `AI Review started for task: ${task.title}\n` +
      `Task ID: ${taskId}\n` +
      `Started at: ${new Date().toISOString()}\n` +
      `${'='.repeat(80)}\n\n`,
      'utf-8'
    );

    // Update task status
    task.status = 'in_progress';
    task.phase = 'ai_review';
    await taskPersistence.saveTask(task);

    await fs.appendFile(logsPath, `[Starting AI Review] ${qaSubtasks.length} QA subtasks to verify\n`, 'utf-8');

    // Start sequential execution
    await fs.appendFile(logsPath, `\n${'='.repeat(80)}\n[Starting Sequential QA Verification]\n${'='.repeat(80)}\n\n`, 'utf-8');

    // Execute QA subtasks one by one
    await executeQASubtasksSequentially(taskId, task.subtasks, logsPath);

    return NextResponse.json({
      success: true,
      message: 'AI Review started - executing QA subtasks',
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * Execute QA subtasks sequentially
 */
async function executeQASubtasksSequentially(taskId: string, allSubtasks: Subtask[], logsPath: string) {
  // Filter to only QA subtasks and get their indices in the full array
  const qaIndices = allSubtasks
    .map((s, i) => s.type === 'qa' ? i : -1)
    .filter(i => i !== -1);

  for (let count = 0; count < qaIndices.length; count++) {
    const subtaskIndex = qaIndices[count];
    const subtask = allSubtasks[subtaskIndex];

    // Load fresh task data to check current status
    const task = await taskPersistence.loadTask(taskId);
    if (!task) return;

    // Check if this subtask was already completed (e.g., skipped by user)
    if (task.subtasks[subtaskIndex].status === 'completed') {
      await fs.appendFile(
        logsPath,
        `\n${'='.repeat(80)}\n[QA Subtask ${count + 1}/${qaIndices.length}] ${subtask.label} - SKIPPED (already completed)\n${'='.repeat(80)}\n\n`,
        'utf-8'
      );
      continue; // Skip to next subtask
    }

    await fs.appendFile(
      logsPath,
      `\n${'='.repeat(80)}\n[QA Subtask ${count + 1}/${qaIndices.length}] ${subtask.label}\n${'='.repeat(80)}\n\n`,
      'utf-8'
    );

    // Update subtask to in_progress
    task.subtasks[subtaskIndex].status = 'in_progress';
    await taskPersistence.saveTask(task);

    // Execute subtask
    const prompt = `Execute the following QA verification subtask:

**QA Subtask:** ${subtask.label}
**Details:** ${subtask.content}

Please verify and test this thoroughly following best practices.`;

    // Create completion handler for this subtask
    const onSubtaskComplete = async (result: { success: boolean; output: string; error?: string }) => {
      await fs.appendFile(logsPath, `\n[QA Subtask ${count + 1} Completed] Success: ${result.success}\n`, 'utf-8');

      if (!result.success) {
        await fs.appendFile(logsPath, `[Error] ${result.error}\n`, 'utf-8');

        const currentTask = await taskPersistence.loadTask(taskId);
        if (currentTask) {
          currentTask.subtasks[subtaskIndex].status = 'pending'; // Reset to pending on error
          currentTask.status = 'blocked';
          await taskPersistence.saveTask(currentTask);
        }
        return;
      }

      await fs.appendFile(logsPath, `[Output]\n${result.output}\n`, 'utf-8');

      // Mark subtask as completed
      const currentTask = await taskPersistence.loadTask(taskId);
      if (currentTask) {
        currentTask.subtasks[subtaskIndex].status = 'completed';

        // Check if all QA subtasks are completed
        const allQACompleted = currentTask.subtasks
          .filter(s => s.type === 'qa')
          .every(s => s.status === 'completed');

        if (allQACompleted && currentTask.phase === 'ai_review') {
          currentTask.phase = 'human_review'; // Move to human review phase
          currentTask.status = 'completed';
          currentTask.assignedAgent = undefined; // Clear agent
          await fs.appendFile(logsPath, `\n${'='.repeat(80)}\n[ALL QA SUBTASKS COMPLETED - Moving to Human Review]\n${'='.repeat(80)}\n`, 'utf-8');
        }

        await taskPersistence.saveTask(currentTask);
      }
    };

    // Start agent for this QA subtask
    const subtaskThreadId = await agentManager.startAgent(taskId, prompt, {
      workingDir: task.worktreePath || process.cwd(),
      onComplete: onSubtaskComplete,
    });

    await fs.appendFile(logsPath, `[Agent Started for QA Subtask] Thread ID: ${subtaskThreadId}\n`, 'utf-8');

    // Store the thread ID in task for potential cancellation
    const taskWithThread = await taskPersistence.loadTask(taskId);
    if (taskWithThread) {
      taskWithThread.assignedAgent = subtaskThreadId;
      await taskPersistence.saveTask(taskWithThread);
    }

    // Wait for this subtask to complete before moving to next
    // (The completion callback will handle marking it complete)
    await waitForSubtaskCompletion(taskId, subtaskIndex);
  }
}

/**
 * Wait for a subtask to complete
 */
async function waitForSubtaskCompletion(taskId: string, subtaskIndex: number): Promise<void> {
  return new Promise((resolve) => {
    let elapsed = 0;
    const maxWait = 60000; // 60 seconds max wait

    const interval = setInterval(async () => {
      elapsed += 500;

      // Timeout after max wait
      if (elapsed >= maxWait) {
        clearInterval(interval);
        console.error(`[waitForSubtaskCompletion] Timeout waiting for QA subtask ${subtaskIndex}`);
        resolve();
        return;
      }

      const task = await taskPersistence.loadTask(taskId);
      if (!task) {
        clearInterval(interval);
        resolve();
        return;
      }

      // Check if task is blocked or completed
      if (task.status === 'blocked' || task.status === 'completed') {
        clearInterval(interval);
        resolve();
        return;
      }

      // Check if subtask still exists at this index
      const subtask = task.subtasks[subtaskIndex];
      if (!subtask) {
        // Subtask was deleted
        clearInterval(interval);
        resolve();
        return;
      }

      // Check if subtask is completed
      if (subtask.status === 'completed') {
        clearInterval(interval);
        resolve();
      }
    }, 500); // Check every 500ms
  });
}
