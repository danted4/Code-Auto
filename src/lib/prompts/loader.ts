/**
 * Prompt loader for customizable Plan and Subtask generation.
 * Reads from .code-auto/prompts.json; falls back to built-in defaults.
 */

import fs from 'fs/promises';
import path from 'path';
import {
  PLAN_GENERATION_DEFAULT_TEMPLATE,
  PLAN_GENERATION_SUFFIX,
  PLAN_USER_ANSWERS_INTRO,
  SUBTASK_GENERATION_DEFAULT_TEMPLATE,
  SUBTASK_GENERATION_SUFFIX,
} from './defaults';

const PROMPTS_FILE = 'prompts.json';

export interface ProjectPrompts {
  planGeneration?: {
    custom: boolean;
    template: string;
  };
  subtaskGeneration?: {
    custom: boolean;
    template: string;
  };
}

export interface PlanGenerationAnswers {
  [qId: string]: { selectedOption?: string; additionalText?: string };
}

export interface TaskForPrompt {
  title?: string;
  description?: string;
  cliTool?: string;
  cliConfig?: unknown;
  planContent?: string;
  planningData?: {
    questions?: Array<{ id: string; question?: string; order?: number }>;
  };
}

/**
 * Load prompts from .code-auto/prompts.json.
 * Returns defaults if file missing or invalid.
 */
export async function loadPrompts(projectDir: string): Promise<ProjectPrompts> {
  const filePath = path.join(projectDir, '.code-auto', PROMPTS_FILE);
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data) as ProjectPrompts;
    return parsed;
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err ? (err as NodeJS.ErrnoException).code : '';
    if (code !== 'ENOENT') {
      console.warn('[prompts] Failed to load prompts.json:', err);
    }
    return {};
  }
}

/**
 * Get the plan generation template (user-editable portion).
 * Returns custom template if set, else default.
 */
function getPlanGenerationTemplate(projectDir: string, prompts: ProjectPrompts): string {
  const entry = prompts?.planGeneration;
  if (entry?.custom && entry?.template && entry.template.trim()) {
    return entry.template.trim();
  }
  return PLAN_GENERATION_DEFAULT_TEMPLATE;
}

/**
 * Get the subtask generation template (user-editable portion).
 */
function getSubtaskGenerationTemplate(projectDir: string, prompts: ProjectPrompts): string {
  const entry = prompts?.subtaskGeneration;
  if (entry?.custom && entry?.template && entry.template.trim()) {
    return entry.template.trim();
  }
  return SUBTASK_GENERATION_DEFAULT_TEMPLATE;
}

/**
 * Replace placeholders in a template string.
 */
function replacePlaceholders(template: string, replacements: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(`\\{\\{${escaped}\\}\\}`, 'g'), value ?? '');
  }
  return result;
}

/**
 * Build the {{user_answers}} block for plan-from-answers flow.
 */
function buildUserAnswersBlock(task: TaskForPrompt, answers: PlanGenerationAnswers): string {
  const questions = task.planningData?.questions ?? [];
  if (questions.length === 0) return '';

  const answersBlock = questions
    .map((q) => {
      const answer = answers[q.id];
      const radioAnswer = answer?.selectedOption?.trim();
      const textAnswer = answer?.additionalText?.trim();
      const answerStr =
        radioAnswer && textAnswer
          ? `${radioAnswer}\nAdditional notes: ${textAnswer}`
          : radioAnswer || textAnswer || 'Not answered';
      return `Q${q.order ?? '?'}: ${q.question ?? ''}\nA: ${answerStr}`;
    })
    .join('\n\n');

  return `# User Answers to Planning Questions\n\n${answersBlock}\n\n# PLANNING PHASE: Generate Implementation Plan\n\n${PLAN_USER_ANSWERS_INTRO}`;
}

/**
 * Build the {{user_answers}} block for direct plan (no Q&A).
 */
function buildDirectPlanBlock(): string {
  return `# PLANNING PHASE: Direct Plan Generation

Your goal is to create a comprehensive implementation plan for this task.`;
}

/**
 * Get the full plan generation prompt for the agent.
 * @param task - Task object
 * @param answers - Optional; when provided, uses plan-from-answers flow
 */
export async function getPlanGenerationPrompt(
  task: TaskForPrompt,
  answers: PlanGenerationAnswers | undefined,
  projectDir: string
): Promise<string> {
  const prompts = await loadPrompts(projectDir);
  const template = getPlanGenerationTemplate(projectDir, prompts);

  const userAnswersBlock = answers ? buildUserAnswersBlock(task, answers) : buildDirectPlanBlock();

  const replacements: Record<string, string> = {
    'task.title': task.title ?? '',
    'task.description': task.description ?? '',
    'task.cliTool': task.cliTool ? String(task.cliTool) : 'Not specified',
    'task.cliConfig': task.cliConfig ? JSON.stringify(task.cliConfig, null, 2) : '',
    user_answers: userAnswersBlock,
  };

  const filled = replacePlaceholders(template, replacements);
  return filled + PLAN_GENERATION_SUFFIX;
}

/**
 * Get the full subtask generation prompt for the agent.
 */
export async function getSubtaskGenerationPrompt(
  task: TaskForPrompt,
  projectDir: string
): Promise<string> {
  const prompts = await loadPrompts(projectDir);
  const template = getSubtaskGenerationTemplate(projectDir, prompts);

  const replacements: Record<string, string> = {
    'task.title': task.title ?? '',
    'task.description': task.description ?? '',
    planContent: task.planContent ?? '',
  };

  const filled = replacePlaceholders(template, replacements);
  return filled + SUBTASK_GENERATION_SUFFIX;
}
