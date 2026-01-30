/**
 * Delete Task API Route
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTaskPersistence } from '@/lib/tasks/persistence';
import { getProjectDir } from '@/lib/project-dir';

export async function DELETE(req: NextRequest) {
  try {
    const projectDir = await getProjectDir(req);
    const taskPersistence = getTaskPersistence(projectDir);

    const taskId = req.nextUrl.searchParams.get('taskId');
    if (!taskId) {
      return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
    }

    await taskPersistence.deleteTask(taskId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
