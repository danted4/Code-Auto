'use client';

/**
 * Kanban Column Component
 *
 * Represents a single workflow phase column
 */

import { useDroppable } from '@dnd-kit/core';
import { Task, WorkflowPhase, getPhaseDisplayName } from '@/lib/tasks/schema';
import { TaskCard } from './task-card';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  phase: WorkflowPhase;
  tasks: Task[];
}

export function KanbanColumn({ phase, tasks }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: phase,
  });

  const phaseColors: Record<WorkflowPhase, string> = {
    planning: 'border-t-blue-500',
    in_progress: 'border-t-cyan-500',
    ai_review: 'border-t-yellow-500',
    human_review: 'border-t-purple-500',
    done: 'border-t-green-500',
  };

  return (
    <div
      ref={setNodeRef}
      data-testid={`kanban-column-${phase}`}
      className={cn(
        "flex-shrink-0 w-80 bg-slate-900 rounded-lg border border-slate-700 border-t-4",
        phaseColors[phase]
      )}
    >
      {/* Column Header */}
      <div className="p-4 border-b border-slate-700">
        <h3 className="font-semibold text-base text-white">
          {getPhaseDisplayName(phase)}
        </h3>
        <div data-testid={`task-count-${phase}`} className="mt-2 text-xs text-slate-400">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </div>
      </div>

      {/* Tasks */}
      <div data-testid={`task-list-${phase}`} className="p-3 space-y-3 min-h-[200px] max-h-[calc(100vh-12rem)] overflow-y-auto">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <div data-testid={`empty-state-${phase}`} className="text-center py-8 text-slate-500 text-sm">
            No tasks
          </div>
        )}
      </div>
    </div>
  );
}
