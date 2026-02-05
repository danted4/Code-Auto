/**
 * Dev + QA Feedback Loop Orchestrator
 *
 * Central controller that runs: dev subtasks → QA subtasks → automated checks → on fail, rework loop.
 * This orchestrator manages the entire dev+QA cycle with a rework cap.
 */

import { getTaskPersistence, type TaskPersistence } from '@/lib/tasks/persistence';
import { Task, Subtask } from '@/lib/tasks/schema';
import { startAgentForTask } from '@/lib/agents/registry';
import { buildQASubtaskPrompt } from '@/lib/agents/qa-subtask-prompt';
import {
  runAutomatedChecks,
  generateReworkFeedback,
  QACheckResult,
} from '@/lib/agents/qa-automated-checks';
import { cleanPlanningArtifactsFromWorktree } from '@/lib/worktree/cleanup';
import { releaseOrchestratorLock } from '@/lib/agents/orchestrator-lock';
import fs from 'fs/promises';
import path from 'path';

const MAX_REWORK = 2; // Maximum rework iterations before moving to human review

interface LoopContext {
  taskPersistence: TaskPersistence;
  projectDir: string;
  taskId: string;
  devLogsPath: string;
  reviewLogsPath: string;
}

/**
 * Main orchestrator: run dev → QA → checks → rework loop (with cap) or move to human_review
 */
export async function runDevQALoop(
  taskPersistence: TaskPersistence,
  projectDir: string,
  taskId: string
): Promise<void> {
  const task = await taskPersistence.loadTask(taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  // Setup log paths
  const devLogsPath = path.join(
    projectDir,
    '.code-automata',
    'tasks',
    taskId,
    'development-logs.txt'
  );
  const reviewLogsPath = path.join(
    projectDir,
    '.code-automata',
    'tasks',
    taskId,
    'review-logs.txt'
  );

  const context: LoopContext = {
    taskPersistence,
    projectDir,
    taskId,
    devLogsPath,
    reviewLogsPath,
  };

  // Initialize reworkCount if not set
  if (task.reworkCount === undefined) {
    task.reworkCount = 0;
    await taskPersistence.saveTask(task);
  }

  // Clear the 'resuming' or 'starting' flag if set (from resume/start endpoints)
  if (task.assignedAgent === 'resuming' || task.assignedAgent === 'starting') {
    task.assignedAgent = undefined;
    await taskPersistence.saveTask(task);
  }

  await fs.appendFile(
    devLogsPath,
    `\n[Orchestrator] Starting dev+QA loop (rework count: ${task.reworkCount}/${MAX_REWORK})\n`,
    'utf-8'
  );

  // Step 1: Run dev subtasks (only pending ones if this is a rework)
  await runDevSubtasks(context);

  // Step 2: Move to ai_review and run QA subtasks
  await runQASubtasks(context);

  // Step 3: Run automated checks
  await runChecksAndHandleResult(context);
}

/**
 * Step 1: Execute dev subtasks (only pending ones)
 */
async function runDevSubtasks(context: LoopContext): Promise<void> {
  const { taskPersistence, projectDir, taskId, devLogsPath } = context;

  const task = await taskPersistence.loadTask(taskId);
  if (!task) return;

  const devSubtasks = task.subtasks.filter((s) => s.type === 'dev' && s.status === 'pending');

  if (devSubtasks.length === 0) {
    await fs.appendFile(
      devLogsPath,
      `[Orchestrator] No pending dev subtasks to execute\n`,
      'utf-8'
    );
    return;
  }

  await fs.appendFile(
    devLogsPath,
    `[Orchestrator] Executing ${devSubtasks.length} pending dev subtask(s)\n`,
    'utf-8'
  );

  // Execute dev subtasks sequentially
  for (let i = 0; i < devSubtasks.length; i++) {
    const subtask = devSubtasks[i];

    // Load fresh task
    const currentTask = await taskPersistence.loadTask(taskId);
    if (!currentTask) return;

    const taskSubtaskIndex = currentTask.subtasks.findIndex((s) => s.id === subtask.id);
    if (taskSubtaskIndex === -1) {
      await fs.appendFile(
        devLogsPath,
        `\n[Dev Subtask ${i + 1}/${devSubtasks.length}] ${subtask.label} - SKIPPED (deleted)\n`,
        'utf-8'
      );
      continue;
    }

    // Check if already completed
    if (currentTask.subtasks[taskSubtaskIndex].status === 'completed') {
      await fs.appendFile(
        devLogsPath,
        `\n[Dev Subtask ${i + 1}/${devSubtasks.length}] ${subtask.label} - SKIPPED (already completed)\n`,
        'utf-8'
      );
      continue;
    }

    await fs.appendFile(
      devLogsPath,
      `\n${'='.repeat(80)}\n[Dev Subtask ${i + 1}/${devSubtasks.length}] ${subtask.label}\n${'='.repeat(80)}\n\n`,
      'utf-8'
    );

    // Update subtask to in_progress
    currentTask.subtasks[taskSubtaskIndex].status = 'in_progress';
    await taskPersistence.saveTask(currentTask);

    // Build prompt with QA failure feedback if present
    let prompt = `Execute the following subtask as part of the implementation plan:

**Subtask:** ${subtask.label}
**Details:** ${subtask.content}

Please implement this subtask following best practices.`;

    // Inject QA failure feedback if this is a rework
    if (currentTask.qaFailureFeedback) {
      prompt = `${currentTask.qaFailureFeedback}

---

Now execute the following rework subtask to address the issues above:

**Subtask:** ${subtask.label}
**Details:** ${subtask.content}

Please fix the issues identified in the QA feedback and implement this subtask.`;
    }

    // Execute subtask
    await new Promise<void>((resolve) => {
      const onSubtaskComplete = async (result: {
        success: boolean;
        output: string;
        error?: string;
      }) => {
        await fs.appendFile(
          devLogsPath,
          `\n[Dev Subtask ${i + 1} Completed] Success: ${result.success}\n`,
          'utf-8'
        );

        if (!result.success) {
          await fs.appendFile(devLogsPath, `[Error] ${result.error}\n`, 'utf-8');
          const task = await taskPersistence.loadTask(taskId);
          if (task) {
            // Check if task was intentionally paused (assignedAgent already cleared)
            // If so, don't update status to blocked - user will resume when ready
            if (!task.assignedAgent) {
              await fs.appendFile(
                devLogsPath,
                `[Orchestrator] Task was paused - skipping error handler\n`,
                'utf-8'
              );
              resolve();
              return;
            }

            const idx = task.subtasks.findIndex((s) => s.id === subtask.id);
            if (idx !== -1) {
              task.subtasks[idx].status = 'pending';
            }
            task.status = 'blocked';
            task.assignedAgent = undefined; // Clear agent on error
            await taskPersistence.saveTask(task);
          }
          resolve();
          return;
        }

        await fs.appendFile(devLogsPath, `[Output]\n${result.output}\n`, 'utf-8');

        // Mark subtask as completed
        const task = await taskPersistence.loadTask(taskId);
        if (task) {
          const idx = task.subtasks.findIndex((s) => s.id === subtask.id);
          if (idx !== -1) {
            task.subtasks[idx].status = 'completed';
            task.subtasks[idx].completedAt = Date.now();
          }
          // DON'T clear assignedAgent here - keep it set so UI knows orchestrator is still running
          // It will be overwritten by the next subtask's thread ID, or cleared when orchestrator finishes
          await taskPersistence.saveTask(task);
        }

        resolve();
      };

      startAgentForTask({
        task: currentTask,
        prompt,
        workingDir: currentTask.worktreePath || projectDir,
        projectDir,
        onComplete: onSubtaskComplete,
      }).then(async ({ threadId }) => {
        await fs.appendFile(
          devLogsPath,
          `[Agent Started for Dev Subtask] Thread ID: ${threadId}\n`,
          'utf-8'
        );
        // Update task with agent thread ID
        const task = await taskPersistence.loadTask(taskId);
        if (task) {
          task.assignedAgent = threadId;
          await taskPersistence.saveTask(task);
        }
      });
    });

    // Wait for completion
    await waitForSubtaskCompletion(taskPersistence, taskId, subtask.id);
  }

  await fs.appendFile(devLogsPath, `\n[Orchestrator] Dev subtasks completed\n`, 'utf-8');
}

/**
 * Step 2: Move to ai_review and execute QA subtasks
 */
async function runQASubtasks(context: LoopContext): Promise<void> {
  const { taskPersistence, projectDir, taskId, devLogsPath, reviewLogsPath } = context;

  const task = await taskPersistence.loadTask(taskId);
  if (!task) return;

  // Move to ai_review phase
  task.phase = 'ai_review';
  task.status = 'in_progress';
  // DON'T clear assignedAgent here - the next QA subtask will set its thread ID
  // Keeping it set shows the UI that orchestrator is still running
  await taskPersistence.saveTask(task);

  await fs.appendFile(
    devLogsPath,
    `\n${'='.repeat(80)}\n[Orchestrator] Moving to AI Review phase\n${'='.repeat(80)}\n`,
    'utf-8'
  );

  // Clean planning artifacts
  await cleanPlanningArtifactsFromWorktree(task.worktreePath || projectDir).catch(() => {});

  // Setup review logs
  const logsDir = path.dirname(reviewLogsPath);
  await fs.mkdir(logsDir, { recursive: true });

  const isFirstReview = !(await fs
    .access(reviewLogsPath)
    .then(() => true)
    .catch(() => false));

  if (isFirstReview) {
    await fs.writeFile(
      reviewLogsPath,
      `AI Review started for task: ${task.title}\n` +
        `Task ID: ${taskId}\n` +
        `Started at: ${new Date().toISOString()}\n` +
        `${'='.repeat(80)}\n\n`,
      'utf-8'
    );
  } else {
    await fs.appendFile(
      reviewLogsPath,
      `\n${'='.repeat(80)}\n[Rework ${task.reworkCount || 0}] Re-running QA after fixes\n` +
        `Started at: ${new Date().toISOString()}\n` +
        `${'='.repeat(80)}\n\n`,
      'utf-8'
    );
  }

  // Get QA subtasks (only pending or those needing re-run)
  const qaSubtasks = task.subtasks.filter((s) => s.type === 'qa');

  // Reset QA subtasks to pending if this is a rework (so they run again)
  if (task.reworkCount && task.reworkCount > 0) {
    for (const subtask of qaSubtasks) {
      const idx = task.subtasks.findIndex((s) => s.id === subtask.id);
      if (idx !== -1) {
        task.subtasks[idx].status = 'pending';
      }
    }
    await taskPersistence.saveTask(task);
  }

  await fs.appendFile(
    reviewLogsPath,
    `[Starting QA Verification] ${qaSubtasks.length} QA subtask(s) to verify\n${'='.repeat(80)}\n\n`,
    'utf-8'
  );

  // Build context for QA: list of completed dev subtasks
  const completedDevSubtasks = task.subtasks
    .filter((s) => s.type === 'dev' && s.status === 'completed')
    .map((s) => `- ${s.label}: ${s.content}`)
    .join('\n');

  // Execute QA subtasks sequentially
  for (let count = 0; count < qaSubtasks.length; count++) {
    const subtask = qaSubtasks[count];

    const currentTask = await taskPersistence.loadTask(taskId);
    if (!currentTask) return;

    const taskSubtaskIndex = currentTask.subtasks.findIndex((s) => s.id === subtask.id);
    if (taskSubtaskIndex === -1) {
      await fs.appendFile(
        reviewLogsPath,
        `\n[QA Subtask ${count + 1}/${qaSubtasks.length}] ${subtask.label} - SKIPPED (deleted)\n`,
        'utf-8'
      );
      continue;
    }

    if (currentTask.subtasks[taskSubtaskIndex].status === 'completed') {
      await fs.appendFile(
        reviewLogsPath,
        `\n[QA Subtask ${count + 1}/${qaSubtasks.length}] ${subtask.label} - SKIPPED (already completed)\n`,
        'utf-8'
      );
      continue;
    }

    await fs.appendFile(
      reviewLogsPath,
      `\n${'='.repeat(80)}\n[QA Subtask ${count + 1}/${qaSubtasks.length}] ${subtask.label}\n${'='.repeat(80)}\n\n`,
      'utf-8'
    );

    // Update subtask to in_progress
    currentTask.subtasks[taskSubtaskIndex].status = 'in_progress';
    await taskPersistence.saveTask(currentTask);

    // Build QA prompt with dev context
    const basePrompt = buildQASubtaskPrompt(subtask);
    const promptWithContext = `${basePrompt}

---

**Context: Completed Development Work**

The following dev subtasks were completed for this task:

${completedDevSubtasks}

**Your QA Responsibilities:**

1. **Review code for errors:** Check for syntax issues, runtime problems, and logical errors
2. **Verify plan-code harmony:** Ensure the implementation matches the approved plan
3. **Run verification:** Execute any tests or checks relevant to this subtask

Approved Plan Summary:
${currentTask.planContent?.slice(0, 500) || 'No plan content available'}...

Please verify thoroughly.`;

    // Execute QA subtask
    await new Promise<void>((resolve) => {
      const onSubtaskComplete = async (result: {
        success: boolean;
        output: string;
        error?: string;
      }) => {
        await fs.appendFile(
          reviewLogsPath,
          `\n[QA Subtask ${count + 1} Completed] Success: ${result.success}\n`,
          'utf-8'
        );

        if (!result.success) {
          await fs.appendFile(reviewLogsPath, `[Error] ${result.error}\n`, 'utf-8');
          const task = await taskPersistence.loadTask(taskId);
          if (task) {
            // Check if task was intentionally paused (assignedAgent already cleared)
            // If so, don't update status to blocked - user will resume when ready
            if (!task.assignedAgent) {
              await fs.appendFile(
                reviewLogsPath,
                `[Orchestrator] Task was paused - skipping error handler\n`,
                'utf-8'
              );
              resolve();
              return;
            }

            const idx = task.subtasks.findIndex((s) => s.id === subtask.id);
            if (idx !== -1) {
              task.subtasks[idx].status = 'pending';
            }
            task.status = 'blocked';
            task.assignedAgent = undefined; // Clear agent on error
            await taskPersistence.saveTask(task);
          }
          resolve();
          return;
        }

        await fs.appendFile(reviewLogsPath, `[Output]\n${result.output}\n`, 'utf-8');

        // Mark subtask as completed
        const task = await taskPersistence.loadTask(taskId);
        if (task) {
          const idx = task.subtasks.findIndex((s) => s.id === subtask.id);
          if (idx !== -1) {
            task.subtasks[idx].status = 'completed';
            task.subtasks[idx].completedAt = Date.now();
          }
          // DON'T clear assignedAgent here - keep it set so UI knows orchestrator is still running
          // It will be overwritten by the next subtask's thread ID, or cleared when orchestrator finishes
          await taskPersistence.saveTask(task);
        }

        resolve();
      };

      startAgentForTask({
        task: currentTask,
        prompt: promptWithContext,
        workingDir: currentTask.worktreePath || projectDir,
        projectDir,
        onComplete: onSubtaskComplete,
      }).then(async ({ threadId }) => {
        await fs.appendFile(
          reviewLogsPath,
          `[Agent Started for QA Subtask] Thread ID: ${threadId}\n`,
          'utf-8'
        );
        // Update task with agent thread ID
        const task = await taskPersistence.loadTask(taskId);
        if (task) {
          task.assignedAgent = threadId;
          await taskPersistence.saveTask(task);
        }
      });
    });

    // Wait for completion
    await waitForSubtaskCompletion(taskPersistence, taskId, subtask.id);
  }

  await fs.appendFile(reviewLogsPath, `\n[Orchestrator] QA subtasks completed\n`, 'utf-8');
}

/**
 * Step 3: Run automated checks and handle pass/fail result
 */
async function runChecksAndHandleResult(context: LoopContext): Promise<void> {
  const { taskPersistence, projectDir, taskId, reviewLogsPath } = context;

  const task = await taskPersistence.loadTask(taskId);
  if (!task) return;

  await fs.appendFile(
    reviewLogsPath,
    `\n${'='.repeat(80)}\n[Automated Checks] Running typecheck/build/lint...\n${'='.repeat(80)}\n`,
    'utf-8'
  );

  // Run automated checks in the worktree
  const workingDir = task.worktreePath || projectDir;
  const checkResult = await runAutomatedChecks(workingDir);

  // Save result to task
  task.lastQAResult = {
    overall: checkResult.overall,
    summary: checkResult.summary,
    details: checkResult.details,
  };
  await taskPersistence.saveTask(task);

  await fs.appendFile(
    reviewLogsPath,
    `\n[Automated checks] ${checkResult.overall}: ${checkResult.summary}\n\n${checkResult.details}\n`,
    'utf-8'
  );

  if (checkResult.overall === 'pass') {
    // Success! Move to human_review
    await handleQAPass(context);
  } else {
    // Failure: check rework cap and either loop or move to human_review
    await handleQAFail(context, checkResult);
  }
}

/**
 * Handle QA pass: move to human_review
 */
async function handleQAPass(context: LoopContext): Promise<void> {
  const { taskPersistence, taskId, reviewLogsPath, projectDir } = context;

  const task = await taskPersistence.loadTask(taskId);
  if (!task) return;

  // Clean planning artifacts before human review
  await cleanPlanningArtifactsFromWorktree(task.worktreePath || projectDir).catch(() => {});

  task.phase = 'human_review';
  task.status = 'completed';
  task.assignedAgent = undefined;
  task.qaFailureFeedback = undefined; // Clear feedback on success
  await taskPersistence.saveTask(task);

  // Release orchestrator lock since task is complete
  releaseOrchestratorLock(taskId);

  await fs.appendFile(
    reviewLogsPath,
    `\n${'='.repeat(80)}\n[SUCCESS] All checks passed - Moving to Human Review\n${'='.repeat(80)}\n`,
    'utf-8'
  );
}

/**
 * Handle QA fail: add rework subtask and loop, or move to human_review if at cap
 */
async function handleQAFail(context: LoopContext, checkResult: QACheckResult): Promise<void> {
  const { taskPersistence, taskId, devLogsPath, reviewLogsPath } = context;

  const task = await taskPersistence.loadTask(taskId);
  if (!task) return;

  const currentReworkCount = task.reworkCount || 0;

  if (currentReworkCount >= MAX_REWORK) {
    // At cap: move to human_review with a note
    task.phase = 'human_review';
    task.status = 'completed';
    task.assignedAgent = undefined;
    await taskPersistence.saveTask(task);

    // Release orchestrator lock since task is complete (with rework cap reached)
    releaseOrchestratorLock(taskId);

    await fs.appendFile(
      reviewLogsPath,
      `\n${'='.repeat(80)}\n[REWORK CAP REACHED] QA issues remain after ${MAX_REWORK} rework iteration(s).\n` +
        `Moving to Human Review for manual intervention.\n${'='.repeat(80)}\n`,
      'utf-8'
    );

    return;
  }

  // Under cap: add rework subtask and loop
  await fs.appendFile(
    reviewLogsPath,
    `\n${'='.repeat(80)}\n[FAILURE] Automated checks failed. Adding rework subtask (${currentReworkCount + 1}/${MAX_REWORK})...\n${'='.repeat(80)}\n`,
    'utf-8'
  );

  // Generate rework feedback
  const reworkFeedback = generateReworkFeedback(checkResult);
  task.qaFailureFeedback = reworkFeedback;
  task.reworkCount = currentReworkCount + 1;

  // Add a rework dev subtask
  const reworkSubtask: Subtask = {
    id: `subtask-rework-${task.reworkCount}`,
    content: `Fix issues identified in QA automated checks (rework ${task.reworkCount}/${MAX_REWORK}):\n\n${checkResult.summary}`,
    label: `Rework (${task.reworkCount}/${MAX_REWORK})`,
    status: 'pending',
    type: 'dev',
    activeForm: `Fixing QA issues (${task.reworkCount}/${MAX_REWORK})`,
  };

  task.subtasks.push(reworkSubtask);

  // Move back to in_progress
  task.phase = 'in_progress';
  task.status = 'in_progress';
  await taskPersistence.saveTask(task);

  await fs.appendFile(
    devLogsPath,
    `\n${'='.repeat(80)}\n[Rework ${task.reworkCount}/${MAX_REWORK}] QA failed - adding rework subtask and re-running dev\n${'='.repeat(80)}\n`,
    'utf-8'
  );

  // Recursively call orchestrator to run the rework subtask → QA → checks again
  await runDevQALoop(taskPersistence, context.projectDir, taskId);
}

/**
 * Wait for a subtask to complete
 */
async function waitForSubtaskCompletion(
  taskPersistence: TaskPersistence,
  taskId: string,
  subtaskId: string
): Promise<void> {
  return new Promise((resolve) => {
    let elapsed = 0;
    const configured = Number(process.env.CODE_AUTOMATA_SUBTASK_WAIT_MS || '');
    const maxWait = Number.isFinite(configured) && configured > 0 ? configured : 30 * 60 * 1000;

    const interval = setInterval(async () => {
      elapsed += 1000;

      if (elapsed >= maxWait) {
        clearInterval(interval);
        console.error(`[waitForSubtaskCompletion] Timeout waiting for subtask ${subtaskId}`);
        resolve();
        return;
      }

      const task = await taskPersistence.loadTask(taskId);
      if (!task) {
        clearInterval(interval);
        resolve();
        return;
      }

      if (task.status === 'blocked' || task.status === 'completed') {
        clearInterval(interval);
        resolve();
        return;
      }

      const subtask = task.subtasks.find((s) => s.id === subtaskId);
      if (!subtask) {
        clearInterval(interval);
        resolve();
        return;
      }

      if (subtask.status === 'completed') {
        clearInterval(interval);
        resolve();
      }
    }, 1000);
  });
}
