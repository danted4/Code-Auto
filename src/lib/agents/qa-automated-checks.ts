/**
 * QA Automated Checks
 *
 * Runs automated checks (typecheck, build, lint) in the task worktree after QA subtasks complete.
 * Returns pass/fail result that drives the dev+QA feedback loop.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export interface QACheckResult {
  overall: 'pass' | 'fail';
  summary: string;
  details: string;
  checks: {
    typecheck?: { passed: boolean; output: string };
    build?: { passed: boolean; output: string };
    lint?: { passed: boolean; output: string };
  };
}

/**
 * Detect package manager from lockfiles
 */
async function detectPackageManager(workingDir: string): Promise<'yarn' | 'pnpm' | 'npm'> {
  try {
    await fs.access(path.join(workingDir, 'yarn.lock'));
    return 'yarn';
  } catch {}

  try {
    await fs.access(path.join(workingDir, 'pnpm-lock.yaml'));
    return 'pnpm';
  } catch {}

  return 'npm';
}

/**
 * Check if a script exists in package.json
 */
async function hasScript(workingDir: string, scriptName: string): Promise<boolean> {
  try {
    const packageJsonPath = path.join(workingDir, 'package.json');
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    return !!(packageJson.scripts && packageJson.scripts[scriptName]);
  } catch {
    return false;
  }
}

/**
 * Run a command and return result
 */
async function runCommand(
  command: string,
  workingDir: string
): Promise<{ passed: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: workingDir,
      timeout: 5 * 60 * 1000, // 5 min timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
    });
    const output = `${stdout}\n${stderr}`.trim();
    return { passed: true, output };
  } catch (error: unknown) {
    const err = error as { stdout?: string; stderr?: string; message?: string };
    const output = err.stdout
      ? `${err.stdout}\n${err.stderr || ''}`.trim()
      : err.message || 'Unknown error';
    return { passed: false, output };
  }
}

/**
 * Run automated checks in the task worktree.
 * Checks run in order: typecheck, build (if present), lint (if present).
 * Returns overall pass/fail and detailed results.
 */
export async function runAutomatedChecks(workingDir: string): Promise<QACheckResult> {
  const result: QACheckResult = {
    overall: 'pass',
    summary: '',
    details: '',
    checks: {},
  };

  // Check for force-fail env var (for testing rework path)
  if (process.env.CODE_AUTOMATA_QA_FORCE_FAIL === '1') {
    result.overall = 'fail';
    result.summary = '[SIMULATED FAILURE] CODE_AUTOMATA_QA_FORCE_FAIL=1 (for testing rework path)';
    result.details =
      'This is a simulated failure for testing. Unset CODE_AUTOMATA_QA_FORCE_FAIL to run real checks.';
    return result;
  }

  const packageManager = await detectPackageManager(workingDir);
  const results: string[] = [];
  const detailLines: string[] = [];

  // 1. Typecheck
  detailLines.push('=== Typecheck ===');
  const hasTypecheckScript = await hasScript(workingDir, 'typecheck');
  const typecheckCmd = hasTypecheckScript ? `${packageManager} run typecheck` : 'npx tsc --noEmit';

  const typecheckResult = await runCommand(typecheckCmd, workingDir);
  result.checks.typecheck = typecheckResult;

  if (typecheckResult.passed) {
    results.push('✓ typecheck passed');
    detailLines.push(`✓ Typecheck passed\n${typecheckResult.output || '(no output)'}`);
  } else {
    result.overall = 'fail';
    results.push('✗ typecheck failed');
    detailLines.push(`✗ Typecheck failed\n${typecheckResult.output}`);
  }

  // 2. Build (if script exists)
  const hasBuildScript = await hasScript(workingDir, 'build');
  if (hasBuildScript) {
    detailLines.push('\n=== Build ===');
    const buildCmd = `${packageManager} run build`;
    const buildResult = await runCommand(buildCmd, workingDir);
    result.checks.build = buildResult;

    if (buildResult.passed) {
      results.push('✓ build passed');
      detailLines.push(`✓ Build passed\n${buildResult.output || '(no output)'}`);
    } else {
      result.overall = 'fail';
      results.push('✗ build failed');
      detailLines.push(`✗ Build failed\n${buildResult.output}`);
    }
  }

  // 3. Lint (if script exists)
  const hasLintScript = await hasScript(workingDir, 'lint');
  if (hasLintScript) {
    detailLines.push('\n=== Lint ===');
    const lintCmd = `${packageManager} run lint`;
    const lintResult = await runCommand(lintCmd, workingDir);
    result.checks.lint = lintResult;

    if (lintResult.passed) {
      results.push('✓ lint passed');
      detailLines.push(`✓ Lint passed\n${lintResult.output || '(no output)'}`);
    } else {
      result.overall = 'fail';
      results.push('✗ lint failed');
      detailLines.push(`✗ Lint failed\n${lintResult.output}`);
    }
  }

  result.summary = results.join(', ');
  result.details = detailLines.join('\n');

  return result;
}

/**
 * Generate rework feedback message from check results for dev agent context
 */
export function generateReworkFeedback(checkResult: QACheckResult): string {
  const lines: string[] = [
    'Previous QA phase failed automated checks. Please address the following issues:',
    '',
  ];

  if (checkResult.checks.typecheck && !checkResult.checks.typecheck.passed) {
    lines.push('## Typecheck Errors');
    lines.push('```');
    lines.push(checkResult.checks.typecheck.output);
    lines.push('```');
    lines.push('');
  }

  if (checkResult.checks.build && !checkResult.checks.build.passed) {
    lines.push('## Build Errors');
    lines.push('```');
    lines.push(checkResult.checks.build.output);
    lines.push('```');
    lines.push('');
  }

  if (checkResult.checks.lint && !checkResult.checks.lint.passed) {
    lines.push('## Lint Errors');
    lines.push('```');
    lines.push(checkResult.checks.lint.output);
    lines.push('```');
    lines.push('');
  }

  lines.push('Please fix these issues. The task will be re-verified after your fixes.');

  return lines.join('\n');
}
