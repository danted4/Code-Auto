/**
 * List Tasks API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTaskPersistence } from '@/lib/tasks/persistence';
import { getProjectDir } from '@/lib/project-dir';
import { clearStaleAgentsFromTasks } from '@/lib/tasks/cleanup-stale-agents';

export async function GET(req: NextRequest) {
  try {
    const projectDir = await getProjectDir(req);
    const taskPersistence = getTaskPersistence(projectDir);
    const tasks = await taskPersistence.listTasks();

    // Clean up stale agent threads (happens after app restart)
    const { modifiedCount, tasks: cleanedTasks } = clearStaleAgentsFromTasks(tasks);

    // Save any tasks that were modified
    if (modifiedCount > 0) {
      console.log(`[Tasks API] Cleaned up ${modifiedCount} task(s) with stale agents`);
      // Save all modified tasks
      const stuckTasks = cleanedTasks.filter(
        (t) => !t.assignedAgent && (t.phase === 'in_progress' || t.phase === 'ai_review')
      );
      await Promise.all(stuckTasks.map((task) => taskPersistence.saveTask(task)));
    }

    return NextResponse.json(cleanedTasks);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
