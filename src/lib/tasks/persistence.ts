/**
 * Task Persistence Layer
 *
 * File-based storage for tasks using JSON files
 */

import fs from 'fs/promises';
import path from 'path';
import { Task, WORKFLOW_PHASES } from './schema';

export class TaskPersistence {
  private readonly projectDir: string;
  private readonly tasksDir: string;
  private readonly implementationPlanPath: string;

  constructor(projectDir: string = process.cwd()) {
    this.projectDir = projectDir;
    this.tasksDir = path.join(projectDir, '.code-automata', 'tasks');
    this.implementationPlanPath = path.join(
      projectDir,
      '.code-automata',
      'implementation_plan.json'
    );
  }

  /**
   * Ensure tasks directory exists
   */
  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.tasksDir, { recursive: true });
  }

  /**
   * Save a task to disk
   */
  async saveTask(task: Task): Promise<void> {
    await this.ensureDir();
    const filePath = path.join(this.tasksDir, `${task.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(task, null, 2));

    // Also update implementation_plan.json for Code-Automata compatibility
    await this.updateImplementationPlan();
  }

  /**
   * Load a task from disk
   */
  async loadTask(taskId: string): Promise<Task | null> {
    const filePath = path.join(this.tasksDir, `${taskId}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as Task;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null; // File doesn't exist
      }

      // Handle JSON parsing errors
      if (error instanceof SyntaxError) {
        console.error(`[TaskPersistence] JSON parsing error for task ${taskId}:`, error.message);
        console.error(`[TaskPersistence] File path: ${filePath}`);
        // Return null for corrupted files instead of throwing
        // This allows the system to continue functioning with other tasks
        return null;
      }

      throw error;
    }
  }

  /**
   * List all tasks
   */
  async listTasks(): Promise<Task[]> {
    await this.ensureDir();
    try {
      const files = await fs.readdir(this.tasksDir);
      const taskFiles = files.filter((f) => f.endsWith('.json'));

      const tasks = await Promise.all(
        taskFiles.map(async (file) => {
          const taskId = file.replace('.json', '');
          return this.loadTask(taskId);
        })
      );

      // Filter out nulls (missing or corrupted files) and sort by creation date
      const validTasks = tasks.filter((t): t is Task => t !== null);

      // Log if any tasks were skipped due to corruption
      const skippedCount = tasks.length - validTasks.length;
      if (skippedCount > 0) {
        console.warn(`[TaskPersistence] Skipped ${skippedCount} corrupted task file(s)`);
      }

      return validTasks.sort((a, b) => b.createdAt - a.createdAt);
    } catch (_error) {
      return [];
    }
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<void> {
    const filePath = path.join(this.tasksDir, `${taskId}.json`);
    try {
      await fs.unlink(filePath);
      await this.updateImplementationPlan();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(taskId: string, status: Task['status']): Promise<void> {
    const task = await this.loadTask(taskId);
    if (task) {
      task.status = status;
      task.updatedAt = Date.now();
      await this.saveTask(task);
    }
  }

  /**
   * Update task phase
   */
  async updateTaskPhase(taskId: string, phase: Task['phase']): Promise<void> {
    const task = await this.loadTask(taskId);
    if (task) {
      task.phase = phase;
      task.updatedAt = Date.now();
      await this.saveTask(task);
    }
  }

  /**
   * Update implementation_plan.json (Code-Automata compatibility)
   */
  private async updateImplementationPlan(): Promise<void> {
    const tasks = await this.listTasks();

    const plan = {
      version: '1.0',
      updated: new Date().toISOString(),
      totalTasks: tasks.length,
      phases: WORKFLOW_PHASES.map((phase) => ({
        name: phase,
        tasks: tasks
          .filter((t) => t.phase === phase)
          .map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            subtasks: t.subtasks.length,
            assignedAgent: t.assignedAgent,
          })),
      })),
    };

    try {
      await fs.writeFile(this.implementationPlanPath, JSON.stringify(plan, null, 2));
    } catch (error) {
      console.error('Failed to update implementation plan:', error);
    }
  }
}

const persistenceCache = new Map<string, TaskPersistence>();

/**
 * Get TaskPersistence instance for the given project directory.
 * Caches instances by projectDir for efficiency.
 */
export function getTaskPersistence(projectDir: string): TaskPersistence {
  let instance = persistenceCache.get(projectDir);
  if (!instance) {
    instance = new TaskPersistence(projectDir);
    persistenceCache.set(projectDir, instance);
  }
  return instance;
}

// Legacy export for backward compatibility - uses process.cwd()
export const taskPersistence = new TaskPersistence();
