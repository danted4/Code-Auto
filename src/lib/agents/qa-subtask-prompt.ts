/**
 * QA Subtask Prompt Builder
 *
 * Builds prompts for QA subtask execution. Manual QA subtasks (label/content
 * contains "manual") get constrained instructions: exactly 1 .md file in
 * manual-qa-required/ folder, concise documentation for human verification.
 */

import type { Subtask } from '@/lib/tasks/schema';

const MANUAL_QA_FOLDER = 'manual-qa-required';

/**
 * Detect if a QA subtask requires manual human verification.
 * Uses label/content containing "manual" (case-insensitive).
 */
export function isManualQASubtask(subtask: Pick<Subtask, 'label' | 'content'>): boolean {
  const haystack = `${subtask.label || ''} ${subtask.content || ''}`.toLowerCase();
  return haystack.includes('manual');
}

/**
 * Build the prompt for executing a QA subtask.
 * For manual subtasks: instructs agent to write exactly 1 .md file to
 * manual-qa-required/<subtask-id>.md, concise content only.
 */
export function buildQASubtaskPrompt(subtask: Subtask): string {
  const isManual = isManualQASubtask(subtask);
  const docPath = `${MANUAL_QA_FOLDER}/${subtask.id}.md`;

  if (isManual) {
    return `Execute the following QA verification subtask (requires manual human verification):

**QA Subtask:** ${subtask.label}
**Details:** ${subtask.content}

IMPORTANT - This is a MANUAL QA subtask. You must:
1. Create exactly ONE markdown file for human verification
2. Write it to: ${docPath}
3. Keep the document CONCISE - only what the human needs to verify (checklist, steps, or brief notes)
4. Do NOT write multiple docs or lengthy documentation - one short .md file only
5. Create the manual-qa-required folder if it does not exist

Verify and document what a human should check. Be brief.`;
  }

  return `Execute the following QA verification subtask:

**QA Subtask:** ${subtask.label}
**Details:** ${subtask.content}

Please verify and test this thoroughly following best practices.`;
}
