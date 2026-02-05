/**
 * Cleanup stale agent threads from tasks
 *
 * When the app restarts, agent threads are lost but tasks still have assignedAgent set.
 * This utility detects and clears stale agent threads.
 */

import { Task } from './schema';
import { isThreadActive } from '@/lib/agents/registry';
import { isOrchestratorLocked } from '@/lib/agents/orchestrator-lock';

/**
 * Check if a task has a stale agent thread and clear it
 * Returns true if the task was modified
 */
export function clearStaleAgent(task: Task): boolean {
  if (!task.assignedAgent) {
    return false; // No agent to clear
  }

  // CRITICAL: Don't clear assignedAgent if orchestrator is actively running
  // The orchestrator sets assignedAgent to different thread IDs as it progresses through subtasks
  // Between subtasks, the old thread may not be in registry, but orchestrator is still running
  if (isOrchestratorLocked(task.id)) {
    return false; // Orchestrator is running, don't interfere
  }

  // Don't clear if the task is in a temporary "resuming" state
  // This is a temporary placeholder value while orchestrator is starting
  if (task.assignedAgent === 'resuming') {
    return false; // Orchestrator is resuming, don't clear
  }

  // Check if the thread is actually active
  if (isThreadActive(task.assignedAgent)) {
    return false; // Agent is active, don't clear
  }

  // Thread is stale and orchestrator isn't running - clear it
  task.assignedAgent = undefined;

  // Also reset any in_progress subtasks to pending
  // This ensures they'll be re-executed on resume
  let resetCount = 0;
  for (const subtask of task.subtasks) {
    if (subtask.status === 'in_progress') {
      subtask.status = 'pending';
      resetCount++;
    }
  }

  console.log(
    `[Cleanup] Cleared stale agent for task ${task.id}, reset ${resetCount} in_progress subtask(s)`
  );

  return true; // Task was modified
}

/**
 * Clear stale agents from multiple tasks
 * Returns the number of tasks that were modified
 */
export function clearStaleAgentsFromTasks(tasks: Task[]): { modifiedCount: number; tasks: Task[] } {
  let modifiedCount = 0;

  for (const task of tasks) {
    if (clearStaleAgent(task)) {
      modifiedCount++;
    }
  }

  return { modifiedCount, tasks };
}
