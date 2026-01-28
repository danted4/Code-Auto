/**
 * Cursor Preflight API Route
 *
 * Check Cursor Agent CLI readiness (similar to Amp preflight)
 */

import { NextResponse } from 'next/server';
import { cursorPreflight } from '@/lib/cursor/preflight';

export async function GET() {
  try {
    const result = await cursorPreflight();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Cursor preflight failed',
        agentCliPath: null,
        authSource: 'missing',
        canRunCursor: false,
        instructions: ['Failed to check Cursor readiness'],
        diagnostics: {
          hasEnvApiKey: false,
          cliLoginDetected: false,
        },
      },
      { status: 500 }
    );
  }
}
