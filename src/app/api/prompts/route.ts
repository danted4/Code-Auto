/**
 * Prompts API Route
 *
 * GET: Return current prompts (custom + template, or default template)
 * POST: Save custom prompts to .code-auto/prompts.json
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProjectDir } from '@/lib/project-dir';
import { loadPrompts, type ProjectPrompts } from '@/lib/prompts/loader';
import {
  PLAN_GENERATION_DEFAULT_TEMPLATE,
  SUBTASK_GENERATION_DEFAULT_TEMPLATE,
} from '@/lib/prompts/defaults';
import fs from 'fs/promises';
import path from 'path';

const PROMPTS_FILE = 'prompts.json';

export async function GET(req: NextRequest) {
  try {
    const projectDir = await getProjectDir(req);
    const prompts = await loadPrompts(projectDir);

    const planGen = prompts?.planGeneration;
    const subtaskGen = prompts?.subtaskGeneration;

    return NextResponse.json({
      planGeneration: {
        custom: Boolean(planGen?.custom && planGen?.template?.trim()),
        template:
          planGen?.custom && planGen?.template?.trim()
            ? planGen.template
            : PLAN_GENERATION_DEFAULT_TEMPLATE,
      },
      subtaskGeneration: {
        custom: Boolean(subtaskGen?.custom && subtaskGen?.template?.trim()),
        template:
          subtaskGen?.custom && subtaskGen?.template?.trim()
            ? subtaskGen.template
            : SUBTASK_GENERATION_DEFAULT_TEMPLATE,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load prompts' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const projectDir = await getProjectDir(req);
    const body = await req.json();

    const planGen = body.planGeneration as { template?: string } | undefined;
    const subtaskGen = body.subtaskGeneration as { template?: string } | undefined;

    const codeAutoDir = path.join(projectDir, '.code-auto');
    await fs.mkdir(codeAutoDir, { recursive: true });

    const filePath = path.join(codeAutoDir, PROMPTS_FILE);

    const existing = await loadPrompts(projectDir);
    const updated: ProjectPrompts = { ...existing };

    if (planGen !== undefined) {
      const template = typeof planGen?.template === 'string' ? planGen.template.trim() : '';
      updated.planGeneration = {
        custom: template.length > 0,
        template: template || PLAN_GENERATION_DEFAULT_TEMPLATE,
      };
    }

    if (subtaskGen !== undefined) {
      const template = typeof subtaskGen?.template === 'string' ? subtaskGen.template.trim() : '';
      updated.subtaskGeneration = {
        custom: template.length > 0,
        template: template || SUBTASK_GENERATION_DEFAULT_TEMPLATE,
      };
    }

    await fs.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8');

    return NextResponse.json({
      success: true,
      message: 'Prompts saved',
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save prompts' },
      { status: 500 }
    );
  }
}
