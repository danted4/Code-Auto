/**
 * CLI Adapters API
 *
 * Returns available CLI adapters and their configuration schemas
 */

import { NextResponse } from 'next/server';
import { CLIFactory } from '@/lib/cli/factory';
import { CursorAdapter } from '@/lib/cli/cursor';

export async function GET() {
  try {
    const adapters = CLIFactory.getAvailableAdapters();

    // Prefetch Cursor models to warm the cache before getConfigSchema() is called
    const prefetchPromises = adapters.map(async (adapter) => {
      if (adapter.name === 'cursor') {
        try {
          const cursorAdapter = new CursorAdapter();
          // Prefetch models (warms cache)
          await (cursorAdapter as any).fetchAvailableModels();
        } catch (err) {
          console.warn('[API] Failed to prefetch Cursor models:', err);
        }
      }
    });

    await Promise.all(prefetchPromises);

    // Get config schema for each adapter (now Cursor will have cached models)
    const adaptersWithSchemas = adapters.map(adapter => {
      try {
        const adapterInstance = CLIFactory.create(adapter.name as any);
        return {
          name: adapter.name,
          displayName: adapter.displayName,
          configSchema: adapterInstance.getConfigSchema(),
        };
      } catch (error) {
        console.error(`Failed to load adapter ${adapter.name}:`, error);
        return null;
      }
    }).filter(Boolean);

    return NextResponse.json(adaptersWithSchemas);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to load CLI adapters' },
      { status: 500 }
    );
  }
}
