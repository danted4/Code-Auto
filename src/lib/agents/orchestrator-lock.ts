/**
 * Orchestrator Lock
 *
 * In-memory lock to prevent concurrent orchestrator starts for the same task.
 * This solves race conditions that file-based checks can't handle.
 */

const orchestratorLocks = new Map<
  string,
  { timestamp: number; operation: 'starting' | 'resuming' }
>();

/**
 * Acquire a lock for starting/resuming a task's orchestrator.
 * Returns true if lock acquired, false if already locked.
 */
export function acquireOrchestratorLock(
  taskId: string,
  operation: 'starting' | 'resuming'
): boolean {
  const existing = orchestratorLocks.get(taskId);

  if (existing) {
    // Check if lock is stale (older than 30 seconds, which should never happen in normal operation)
    const age = Date.now() - existing.timestamp;
    if (age < 30000) {
      // Lock is still valid
      return false;
    }
    // Lock is stale, remove it and continue
    console.warn(`[Orchestrator Lock] Removing stale lock for task ${taskId} (age: ${age}ms)`);
    orchestratorLocks.delete(taskId);
  }

  // Acquire lock
  orchestratorLocks.set(taskId, { timestamp: Date.now(), operation });
  return true;
}

/**
 * Release the lock for a task's orchestrator.
 */
export function releaseOrchestratorLock(taskId: string): void {
  orchestratorLocks.delete(taskId);
}

/**
 * Check if a task has an active orchestrator lock.
 */
export function isOrchestratorLocked(taskId: string): boolean {
  const lock = orchestratorLocks.get(taskId);
  if (!lock) return false;

  // Check if lock is stale
  const age = Date.now() - lock.timestamp;
  if (age >= 30000) {
    console.warn(`[Orchestrator Lock] Lock for task ${taskId} is stale (age: ${age}ms)`);
    orchestratorLocks.delete(taskId);
    return false;
  }

  return true;
}

/**
 * Get all active locks (for debugging).
 */
export function getActiveLocks(): Array<{ taskId: string; operation: string; age: number }> {
  const locks: Array<{ taskId: string; operation: string; age: number }> = [];
  const now = Date.now();

  for (const [taskId, lock] of orchestratorLocks.entries()) {
    locks.push({
      taskId,
      operation: lock.operation,
      age: now - lock.timestamp,
    });
  }

  return locks;
}
