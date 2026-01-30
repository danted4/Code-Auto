/**
 * Cursor Agent CLI preflight (local dev)
 *
 * Goals:
 * - Verify Cursor Agent CLI is installed (`which agent`)
 * - Verify authentication via `agent status`
 * - Provide structured readiness + user instructions for UI and API routes
 *
 * Notes:
 * - Similar to Amp preflight but for Cursor Agent CLI
 * - Auth is handled by `agent login` or CURSOR_API_KEY env var
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type CursorAuthSource = 'cli_login' | 'env' | 'missing';

export interface CursorPreflightResult {
  agentCliPath: string | null;
  authSource: CursorAuthSource;
  canRunCursor: boolean;
  instructions: string[];
  diagnostics: {
    hasEnvApiKey: boolean;
    cliLoginDetected: boolean;
    statusOutput?: string;
  };
}

function withTimeoutMs<T>(p: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), timeoutMs);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

async function whichAgent(): Promise<string | null> {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  try {
    const { stdout } = await execFileAsync(cmd, ['agent'], { timeout: 1500 });
    const resolved = stdout.trim().split('\n')[0]?.trim();
    return resolved ? resolved : null;
  } catch {
    return null;
  }
}

async function tryAgentStatus(agentCliPath: string): Promise<{ ok: boolean; output: string }> {
  try {
    const result = await withTimeoutMs(execFileAsync(agentCliPath, ['status']), 4000);

    const stdout = result.stdout || '';
    const stderr = result.stderr || '';
    const combined = stdout + stderr;

    // Strip ANSI escape codes (Cursor CLI uses them heavily)
    const cleanOutput = combined
      .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '') // Remove ANSI codes
      .replace(/\x1B\([AB]/g, '') // Remove alternate charset codes
      .trim();

    // Check if output indicates successful login
    const isLoggedIn =
      cleanOutput.includes('Logged in') ||
      cleanOutput.includes('logged in') ||
      cleanOutput.includes('✓') ||
      /\S+@\S+\.\S+/.test(cleanOutput); // Contains email

    return { ok: isLoggedIn, output: cleanOutput };
  } catch (error: unknown) {
    // Even if command "fails", check stderr/stdout for login status
    // Some CLIs return non-zero but still include status info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const err = error as any;
    if (err.stdout || err.stderr) {
      const combined = (err.stdout || '') + (err.stderr || '');
      const cleanOutput = combined
        .replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '')
        .replace(/\x1B\([AB]/g, '')
        .trim();

      const isLoggedIn =
        cleanOutput.includes('Logged in') ||
        cleanOutput.includes('logged in') ||
        cleanOutput.includes('✓') ||
        /\S+@\S+\.\S+/.test(cleanOutput);

      if (isLoggedIn) {
        return { ok: true, output: cleanOutput };
      }

      return { ok: false, output: cleanOutput || err.message };
    }

    const errorOutput = error instanceof Error ? error.message : 'Unknown error';
    return { ok: false, output: errorOutput };
  }
}

export async function cursorPreflight(): Promise<CursorPreflightResult> {
  const instructions: string[] = [];

  const agentCliPath = await whichAgent();
  const hasEnvApiKey = !!process.env.CURSOR_API_KEY;

  if (!agentCliPath) {
    instructions.push('Install the Cursor Agent CLI so `which agent` returns a path.');
    instructions.push('After installing, restart `yarn start` so the app picks it up.');
  }

  // Detect CLI login using `agent status`
  let cliLoginDetected = false;
  let statusOutput: string | undefined;

  if (agentCliPath) {
    const status = await tryAgentStatus(agentCliPath);
    statusOutput = status.output;

    if (status.ok) {
      // If status command succeeds, we assume user is logged in
      cliLoginDetected = true;
    }
  }

  // Prefer CLI login, but fall back to env key
  const authSource: CursorAuthSource = cliLoginDetected
    ? 'cli_login'
    : hasEnvApiKey
      ? 'env'
      : 'missing';

  const canRunCursor = !!agentCliPath && (cliLoginDetected || hasEnvApiKey);

  if (!cliLoginDetected && !hasEnvApiKey) {
    instructions.push('Run `agent login` to authenticate the CLI (preferred).');
    instructions.push('Alternatively, set `CURSOR_API_KEY` in your environment.');
  }

  if (!canRunCursor) {
    instructions.push('After fixing auth/install, refresh this page to re-check readiness.');
  }

  return {
    agentCliPath,
    authSource,
    canRunCursor,
    instructions,
    diagnostics: {
      hasEnvApiKey,
      cliLoginDetected,
      statusOutput,
    },
  };
}
