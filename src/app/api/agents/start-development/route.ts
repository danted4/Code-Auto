/**
 * Start Development API Route
 *
 * Task stays in planning phase until subtasks (dev + qa) are generated successfully.
 * 1. Generate subtasks from approved plan (task remains in planning)
 * 2. Parse & validate subtasks JSON (with fix-agent retry on failure)
 * 3. Only then move to in_progress and execute subtasks sequentially
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTaskPersistence } from '@/lib/tasks/persistence';
import { Subtask } from '@/lib/tasks/schema';
import { startAgentForTask } from '@/lib/agents/registry';
import { getProjectDir } from '@/lib/project-dir';
import {
  extractAndValidateJSON,
  generateValidationFeedback,
  validateSubtasks,
} from '@/lib/validation/subtask-validator';
import { cleanPlanningArtifactsFromWorktree } from '@/lib/worktree/cleanup';
import { getSubtaskGenerationPrompt } from '@/lib/prompts/loader';
import { runDevQALoop } from '@/lib/agents/run-dev-qa-loop';
import { acquireOrchestratorLock, releaseOrchestratorLock } from '@/lib/agents/orchestrator-lock';
import fs from 'fs/promises';
import path from 'path';

const MAX_PARSE_RETRIES = 2; // Initial parse + up to 2 fix-agent attempts

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
    const id = taskId;

    // CRITICAL: Acquire in-memory lock FIRST before any file operations
    // This prevents race conditions that file-based checks can't handle
    if (!acquireOrchestratorLock(id, 'starting')) {
      return NextResponse.json(
        { error: 'Orchestrator is already starting/resuming for this task' },
        { status: 409 }
      );
    }

    // Load task
    const task = await taskPersistence.loadTask(id);
    if (!task) {
      releaseOrchestratorLock(id);
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Check if task has approved plan
    if (!task.planApproved || !task.planContent) {
      releaseOrchestratorLock(id);
      return NextResponse.json(
        { error: 'Task must have an approved plan before starting development' },
        { status: 400 }
      );
    }

    // Ensure development logs directory exists
    const logsPath = path.join(projectDir, '.code-automata', 'tasks', id, 'development-logs.txt');
    const logsDir = path.dirname(logsPath);
    await fs.mkdir(logsDir, { recursive: true });

    // Initialize log file
    await fs.writeFile(
      logsPath,
      `Subtask generation started for task: ${task.title}\n` +
        `Task ID: ${id}\n` +
        `Started at: ${new Date().toISOString()}\n` +
        `(Task remains in planning until subtasks are generated successfully)\n` +
        `${'='.repeat(80)}\n\n`,
      'utf-8'
    );

    // Build subtask generation prompt (custom prompts supported)
    const prompt = await getSubtaskGenerationPrompt(task, projectDir);

    // Create completion handler with parse-retry loop (fix agent when JSON/validation fails)
    const createOnSubtasksGenerated = (parseAttempt: number) => {
      return async (result: { success: boolean; output: string; error?: string }) => {
        const isFixAttempt = parseAttempt > 0;
        await fs.appendFile(
          logsPath,
          `\n[${isFixAttempt ? 'Fix Agent' : 'Subtask Generation'} Completed] Success: ${result.success}\n`,
          'utf-8'
        );

        if (!result.success) {
          await fs.appendFile(logsPath, `[Error] ${result.error}\n`, 'utf-8');

          const currentTask = await taskPersistence.loadTask(id);
          if (currentTask) {
            currentTask.status = 'blocked';
            currentTask.assignedAgent = undefined;
            await taskPersistence.saveTask(currentTask);
          }
          return;
        }

        await fs.appendFile(logsPath, `[Output]\n${result.output}\n`, 'utf-8');

        // Parse and validate subtasks JSON
        try {
          const { data: parsedOutput, error: jsonError } = extractAndValidateJSON(result.output);
          if (jsonError || !parsedOutput) {
            throw new Error(jsonError || 'No JSON found in output');
          }
          await fs.appendFile(logsPath, `[Parsed JSON successfully]\n`, 'utf-8');

          // Validate subtasks structure
          const validation = validateSubtasks(parsedOutput);
          if (!validation.valid) {
            const feedback = generateValidationFeedback(validation);
            throw new Error(feedback);
          }

          const subtasks: Subtask[] = (parsedOutput?.subtasks ?? []) as Subtask[];

          await fs.appendFile(logsPath, `[Validated ${subtasks.length} subtasks]\n`, 'utf-8');

          // Save subtasks to task - NOW move to in_progress (subtasks generated successfully)
          const currentTask = await taskPersistence.loadTask(id);
          if (!currentTask) return;

          // Process subtasks from CLI.
          const processedSubtasks = subtasks.map((s) => {
            const type: 'dev' | 'qa' = inferSubtaskType(s);
            return {
              ...s,
              type,
              status: 'pending' as const,
              activeForm: s.activeForm || `Working on ${s.label}`,
            };
          });

          const devSubtasks = processedSubtasks.filter((s) => s.type === 'dev');
          const qaSubtasks = processedSubtasks.filter((s) => s.type === 'qa');

          const finalQASubtasks =
            qaSubtasks.length > 0
              ? qaSubtasks
              : Array.from({ length: Math.floor(devSubtasks.length * 0.6) }, (_, i) => ({
                  id: `subtask-qa-${i + 1}`,
                  content: `[AUTO] Verify implementation step ${i + 1} - Validate the corresponding development work`,
                  label: `Verify Step ${i + 1}`,
                  type: 'qa' as const,
                  status: 'pending' as const,
                  activeForm: `Verifying Step ${i + 1}`,
                }));

          currentTask.subtasks = [...devSubtasks, ...finalQASubtasks];
          currentTask.phase = 'in_progress'; // Only now move to development
          currentTask.status = 'in_progress';
          currentTask.assignedAgent = undefined;
          await taskPersistence.saveTask(currentTask);

          await fs.appendFile(logsPath, `[Subtasks saved to task]\n`, 'utf-8');

          // Clean planning artifacts from worktree before dev execution
          await cleanPlanningArtifactsFromWorktree(currentTask.worktreePath || projectDir).catch(
            () => {}
          );

          // CRITICAL: Reload task to check for race conditions
          const latestTask = await taskPersistence.loadTask(id);
          if (!latestTask) {
            await fs.appendFile(
              logsPath,
              `[Error] Task not found when starting orchestrator\n`,
              'utf-8'
            );
            return;
          }
          if (latestTask.assignedAgent && latestTask.assignedAgent !== 'starting') {
            await fs.appendFile(
              logsPath,
              `[Error] Another orchestrator already started\n`,
              'utf-8'
            );
            return;
          }

          // Set temporary flag to prevent concurrent starts
          currentTask.assignedAgent = 'starting';
          await taskPersistence.saveTask(currentTask);

          // Start orchestrator: runs dev → QA → checks → rework loop
          await fs.appendFile(
            logsPath,
            `\n${'='.repeat(80)}\n[Starting Dev+QA Loop (Orchestrator)]\n${'='.repeat(80)}\n\n`,
            'utf-8'
          );

          // Run the orchestrator (fire and forget - it will manage the entire loop and release the lock)
          runDevQALoop(taskPersistence, projectDir, id).catch((error) => {
            fs.appendFile(
              logsPath,
              `\n[Orchestrator Error] ${error instanceof Error ? error.message : 'Unknown error'}\n`,
              'utf-8'
            );
            // Clear the flag on error
            taskPersistence.loadTask(id).then((t) => {
              if (t && (t.assignedAgent === 'starting' || t.assignedAgent === 'resuming')) {
                t.assignedAgent = undefined;
                t.status = 'blocked';
                taskPersistence.saveTask(t);
              }
            });
            // Release lock on error
            releaseOrchestratorLock(id);
          });
        } catch (parseError) {
          const errMsg = parseError instanceof Error ? parseError.message : 'Unknown error';
          await fs.appendFile(logsPath, `[Parse/Validation Error] ${errMsg}\n`, 'utf-8');

          // Retry: run fix agent to repair the output
          if (parseAttempt < MAX_PARSE_RETRIES) {
            await fs.appendFile(
              logsPath,
              `\n[Parse Retry] Attempt ${parseAttempt + 1}/${MAX_PARSE_RETRIES} - Starting fix agent...\n`,
              'utf-8'
            );

            const fixPrompt = `Your previous response could not be parsed or validated as valid subtasks JSON.

Error: ${errMsg}

Here is your previous output (it may contain markdown fences, extra text, or invalid JSON - extract and fix it):

---
${result.output}
---

Your task: Extract the subtasks from the output above and return ONLY valid JSON with no markdown fences, no extra text.

Required format:
{
  "subtasks": [
    {
      "id": "subtask-1",
      "content": "Detailed description of work",
      "label": "Short label",
      "activeForm": "Optional: present continuous form",
      "type": "dev" or "qa"
    }
  ]
}

Rules:
- Each subtask must have id, content, label (all non-empty strings)
- Include at least 2 QA subtasks (type: "qa") for verification/testing
- Escape any quotes inside strings (use \\" for literal quotes)
- You MUST output the raw JSON as plain text in your message - writing to a file does NOT work.
- Do NOT create subtasks.json or similar in your working directory - they pollute the worktree.
- Your final message must be ONLY the JSON object`;

            const currentTask = await taskPersistence.loadTask(id);
            if (!currentTask) return;

            const { threadId: fixThreadId } = await startAgentForTask({
              task: currentTask,
              prompt: fixPrompt,
              workingDir: currentTask.worktreePath || projectDir,
              projectDir,
              onComplete: createOnSubtasksGenerated(parseAttempt + 1),
            });

            currentTask.assignedAgent = fixThreadId;
            currentTask.status = 'planning'; // Stay in planning during retry
            currentTask.phase = 'planning';
            await taskPersistence.saveTask(currentTask);
            await fs.appendFile(
              logsPath,
              `[Fix Agent Started] Thread ID: ${fixThreadId}\n`,
              'utf-8'
            );
          } else {
            // Max retries reached - block the task (stays in planning)
            const currentTask = await taskPersistence.loadTask(id);
            if (currentTask) {
              currentTask.status = 'blocked';
              currentTask.assignedAgent = undefined;
              await taskPersistence.saveTask(currentTask);
            }
            await fs.appendFile(
              logsPath,
              `[Max Parse Retries Reached] Task blocked. Subtasks could not be parsed/validated.\n`,
              'utf-8'
            );
            // Release lock since task is blocked
            releaseOrchestratorLock(id);
          }
        }
      };
    };

    // Start subtask generation agent
    await fs.appendFile(logsPath, `[Starting Subtask Generation Agent]\n`, 'utf-8');

    const { threadId } = await startAgentForTask({
      task,
      prompt,
      workingDir: task.worktreePath || projectDir,
      projectDir,
      onComplete: createOnSubtasksGenerated(0),
    });

    // Keep task in planning phase until subtasks are generated successfully
    task.assignedAgent = threadId;
    task.status = 'planning';
    task.phase = 'planning';
    await taskPersistence.saveTask(task);

    await fs.appendFile(logsPath, `[Agent Started] Thread ID: ${threadId}\n`, 'utf-8');

    return NextResponse.json({
      success: true,
      threadId,
      message: 'Generating subtasks - task remains in planning until subtasks are ready',
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

function inferSubtaskType(subtask: Partial<Subtask>): 'dev' | 'qa' {
  if (subtask.type === 'qa') return 'qa';
  if (subtask.type === 'dev') return 'dev';

  const haystack = `${subtask.label || ''} ${subtask.content || ''}`.toLowerCase();
  const qaSignals = [
    'validate',
    'verification',
    'verify',
    'qa',
    'test',
    'tests',
    'unit test',
    'integration',
    'e2e',
    'lint',
    'typecheck',
    'type check',
    'yarn build',
    'pnpm build',
    'npm run build',
    'run build',
    'build passes',
    'check diagrams',
    'mermaid',
    'cross-check',
    'cross check',
    'review',
  ];
  if (qaSignals.some((s) => haystack.includes(s))) return 'qa';
  return 'dev';
}

// Note: Dev and QA subtask execution is now handled by the orchestrator (run-dev-qa-loop.ts)
