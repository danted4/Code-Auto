/**
 * Shared plan generation logic used by submit-answers and retry-plan-parse.
 */

import type { Task } from '@/lib/tasks/schema';
import { getTaskPersistence } from '@/lib/tasks/persistence';
import { startAgentForTask } from '@/lib/agents/registry';
import { cleanPlanningArtifactsFromWorktree } from '@/lib/worktree/cleanup';
import { getPlanGenerationPrompt } from '@/lib/prompts/loader';
import { extractAndValidateJSON } from '@/lib/validation/subtask-validator';
import fs from 'fs/promises';
import path from 'path';

const MAX_PARSE_RETRIES = 2;

export type PlanGenerationAnswers = Record<
  string,
  { selectedOption?: string; additionalText?: string }
>;

export interface StartPlanGenerationParams {
  taskId: string;
  task: Task;
  answers: PlanGenerationAnswers;
  projectDir: string;
  logsPath: string;
  taskPersistence: ReturnType<typeof getTaskPersistence>;
}

/**
 * Start the plan generation agent with the given answers.
 * Used by submit-answers and retry-plan-parse (Resume).
 */
export async function startPlanGeneration(params: StartPlanGenerationParams): Promise<{
  threadId: string;
}> {
  const { taskId, task, answers, projectDir, logsPath, taskPersistence } = params;

  const prompt = await getPlanGenerationPrompt(task, answers, projectDir);

  const createOnComplete = (parseAttempt: number) => {
    return async (result: { success: boolean; output: string; error?: string }) => {
      const isFixAttempt = parseAttempt > 0;
      await fs.appendFile(
        logsPath,
        `\n[${isFixAttempt ? 'Fix Agent' : 'Plan Generation'} Completed] Success: ${result.success}\n`,
        'utf-8'
      );

      if (!result.success) {
        await fs.appendFile(logsPath, `[Error] ${result.error}\n`, 'utf-8');
        const currentTask = await taskPersistence.loadTask(taskId);
        if (currentTask) {
          currentTask.status = 'blocked';
          currentTask.assignedAgent = undefined;
          await taskPersistence.saveTask(currentTask);
        }
        return;
      }

      await fs.appendFile(logsPath, `[Output]\n${result.output}\n`, 'utf-8');

      try {
        const { data: parsedOutput, error: jsonError } = extractAndValidateJSON(result.output);
        if (jsonError || !parsedOutput) {
          throw new Error(jsonError || 'No JSON found in output');
        }
        await fs.appendFile(logsPath, `[Parsed JSON successfully]\n`, 'utf-8');

        const currentTask = await taskPersistence.loadTask(taskId);
        if (!currentTask) return;

        const planContent = (parsedOutput as { plan?: string }).plan;
        if (planContent) {
          await fs.appendFile(logsPath, `[Plan Generated]\n`, 'utf-8');
          currentTask.planContent = planContent;
          currentTask.planningStatus = 'plan_ready';
          currentTask.status = 'pending';
          currentTask.assignedAgent = undefined;
          await taskPersistence.saveTask(currentTask);
          // Clean planning artifacts (agent may have written to files even when output parsed)
          await cleanPlanningArtifactsFromWorktree(task.worktreePath || projectDir).catch(() => {});
          await fs.appendFile(logsPath, `[Task Updated Successfully]\n`, 'utf-8');
          return;
        }
        throw new Error('Parsed JSON has no "plan" field');
      } catch (parseError) {
        const errMsg = parseError instanceof Error ? parseError.message : 'Unknown error';
        await fs.appendFile(logsPath, `[Parse Error] Failed to parse JSON: ${errMsg}\n`, 'utf-8');

        // Fallback: agent may have written plan to implementation-plan.json
        const workingDir = task.worktreePath || projectDir;
        for (const basename of ['implementation-plan.json', 'implementation_plan.json']) {
          try {
            const filePath = path.join(workingDir, basename);
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const fileParsed = JSON.parse(fileContent) as { plan?: string };
            if (fileParsed?.plan && typeof fileParsed.plan === 'string') {
              await fs.appendFile(
                logsPath,
                `[Fallback] Found plan in ${basename}, using it.\n`,
                'utf-8'
              );
              const currentTask = await taskPersistence.loadTask(taskId);
              if (!currentTask) return;
              currentTask.planContent = fileParsed.plan;
              currentTask.planningStatus = 'plan_ready';
              currentTask.status = 'pending';
              currentTask.assignedAgent = undefined;
              await taskPersistence.saveTask(currentTask);
              await cleanPlanningArtifactsFromWorktree(task.worktreePath || projectDir);
              await fs.appendFile(logsPath, `[Task Updated Successfully]\n`, 'utf-8');
              return;
            }
          } catch {
            /* continue */
          }
        }

        // Retry: run fix agent
        if (parseAttempt < MAX_PARSE_RETRIES) {
          await fs.appendFile(
            logsPath,
            `\n[Parse Retry] Attempt ${parseAttempt + 1}/${MAX_PARSE_RETRIES} - Starting fix agent...\n`,
            'utf-8'
          );

          const fixPrompt = `Your previous response could not be parsed as valid JSON.

Parse error: ${errMsg}

Here is your previous output:
---
${result.output}
---

Your task: Output ONLY valid JSON. The system ONLY captures your text output - we cannot read files.
Prefer extracting the plan from the output above. If you previously wrote to implementation-plan.json, you may read it and output its contents wrapped as: {"plan": "<content>"} - but do NOT write new files to the worktree.

Required format:
{
  "plan": "<markdown string - the full implementation plan content>"
}

Rules:
- You MUST output the raw JSON as plain text in your message - writing to a file does NOT work.
- Do NOT create implementation-plan.json or similar in your working directory - they pollute the worktree.
- Escape any quotes inside the plan string (use \\" for literal quotes)
- Do not wrap the JSON in markdown code fences
- Your final message must be ONLY the JSON object`;

          const currentTask = await taskPersistence.loadTask(taskId);
          if (!currentTask) return;

          const { threadId: fixThreadId } = await startAgentForTask({
            task: currentTask,
            prompt: fixPrompt,
            workingDir: currentTask.worktreePath || projectDir,
            projectDir,
            onComplete: createOnComplete(parseAttempt + 1),
          });

          currentTask.assignedAgent = fixThreadId;
          currentTask.status = 'planning';
          currentTask.planningStatus = 'generating_plan';
          await taskPersistence.saveTask(currentTask);
          await fs.appendFile(logsPath, `[Fix Agent Started] Thread ID: ${fixThreadId}\n`, 'utf-8');
        } else {
          const currentTask = await taskPersistence.loadTask(taskId);
          if (currentTask) {
            currentTask.status = 'blocked';
            currentTask.assignedAgent = undefined;
            await taskPersistence.saveTask(currentTask);
          }
          await fs.appendFile(logsPath, `[Max Parse Retries Reached] Task blocked.\n`, 'utf-8');
        }
      }
    };
  };

  await fs.appendFile(logsPath, `[Starting Plan Generation]\n`, 'utf-8');

  const { threadId } = await startAgentForTask({
    task,
    prompt,
    workingDir: task.worktreePath || projectDir,
    projectDir,
    onComplete: createOnComplete(0),
  });

  await fs.appendFile(logsPath, `[Agent Started] Thread ID: ${threadId}\n`, 'utf-8');

  return { threadId };
}
