/**
 * Thread → task index (local dev)
 *
 * Used by `/api/agents/stream` to locate the correct task directory for a thread
 * without relying on in-memory state.
 */

import fs from 'fs/promises';
import path from 'path';

function getIndexPath(projectDir: string): string {
  return path.join(projectDir, '.code-automata', 'thread-index.json');
}

async function readIndex(projectDir: string): Promise<Record<string, string>> {
  const indexPath = getIndexPath(projectDir);
  try {
    const raw = await fs.readFile(indexPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, string>;
    return {};
  } catch {
    return {};
  }
}

async function writeIndex(projectDir: string, index: Record<string, string>): Promise<void> {
  const indexPath = getIndexPath(projectDir);
  const dir = path.dirname(indexPath);
  await fs.mkdir(dir, { recursive: true });
  const tmp = indexPath + `.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await fs.writeFile(tmp, JSON.stringify(index, null, 2), 'utf-8');
  await fs.rename(tmp, indexPath);
}

export async function setThreadTaskId(
  threadId: string,
  taskId: string,
  projectDir: string = process.cwd()
): Promise<void> {
  const index = await readIndex(projectDir);
  index[threadId] = taskId;
  await writeIndex(projectDir, index);
}

export async function getTaskIdForThread(
  threadId: string,
  projectDir: string = process.cwd()
): Promise<string | null> {
  const index = await readIndex(projectDir);
  const taskId = index[threadId];
  return typeof taskId === 'string' ? taskId : null;
}
