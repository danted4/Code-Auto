/**
 * List Tasks API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTaskPersistence } from '@/lib/tasks/persistence';
import { getProjectDir } from '@/lib/project-dir';

export async function GET(req: NextRequest) {
  try {
    const projectDir = await getProjectDir(req);
    const taskPersistence = getTaskPersistence(projectDir);
    const tasks = await taskPersistence.listTasks();
    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
