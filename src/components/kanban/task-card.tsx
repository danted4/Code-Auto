'use client';

/**
 * Task Card Component
 *
 * Draggable task card for the Kanban board
 */

import { useDraggable } from '@dnd-kit/core';
import { useState } from 'react';
import { Task } from '@/lib/tasks/schema';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });

  const style = {
    opacity: isDragging ? 0.3 : 1,
  };

  const statusColors = {
    pending: 'bg-gray-100 text-gray-800',
    in_progress: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    blocked: 'bg-red-100 text-red-800',
  };

  const handleStartAgent = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent drag when clicking button
    setIsStarting(true);
    try {
      const response = await fetch('/api/agents/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          prompt: `Work on task: ${task.title}\n\nDescription: ${task.description}`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to start agent');
      } else {
        // Reload page to see updated task with agent
        window.location.reload();
      }
    } catch (error) {
      alert('Failed to start agent');
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopAgent = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.assignedAgent) return;

    setIsStopping(true);
    try {
      const response = await fetch('/api/agents/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId: task.assignedAgent }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to stop agent');
      } else {
        window.location.reload();
      }
    } catch (error) {
      alert('Failed to stop agent');
    } finally {
      setIsStopping(false);
    }
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      data-testid={`task-card-${task.id}`}
      className="cursor-grab active:cursor-grabbing hover:shadow-lg transition-shadow bg-slate-800 border-slate-700 hover:border-slate-600"
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle data-testid="task-title" className="text-sm font-medium line-clamp-2 text-white">
            {task.title}
          </CardTitle>
          <Badge data-testid="task-status" className={statusColors[task.status]}>
            {task.status.replace('_', ' ')}
          </Badge>
        </div>
        {task.description && (
          <CardDescription data-testid="task-description" className="line-clamp-2 text-xs text-slate-400">
            {task.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="pt-0 space-y-2">
        {task.subtasks.length > 0 && (
          <div data-testid="task-subtasks" className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Progress</span>
              <span className="text-slate-300 font-medium">
                {Math.round((task.subtasks.filter((s) => s.status === 'completed').length / task.subtasks.length) * 100)}%
              </span>
            </div>
            {/* Progress dots */}
            <div className="flex gap-1">
              {task.subtasks.map((subtask, idx) => (
                <div
                  key={subtask.id}
                  className={`w-2 h-2 rounded-full ${
                    subtask.status === 'completed'
                      ? 'bg-green-500'
                      : subtask.status === 'in_progress'
                      ? 'bg-blue-500 animate-pulse'
                      : 'bg-slate-600'
                  }`}
                  title={subtask.content}
                />
              ))}
            </div>
          </div>
        )}

        {task.assignedAgent ? (
          <div className="flex items-center gap-2">
            <div data-testid="agent-status" className="text-xs text-cyan-400 flex-1">
              🤖 Agent working
            </div>
            <Button
              data-testid="pause-agent-button"
              size="sm"
              variant="secondary"
              onClick={handleStopAgent}
              disabled={isStopping}
              className="text-xs bg-slate-600 hover:bg-slate-500"
            >
              <Pause className="w-3 h-3" />
              {isStopping ? 'Pausing...' : 'Pause'}
            </Button>
          </div>
        ) : (
          <Button
            data-testid="start-agent-button"
            size="sm"
            variant="outline"
            onClick={handleStartAgent}
            disabled={isStarting}
            className="w-full text-xs bg-slate-700 hover:bg-slate-600 text-white border-slate-600"
          >
            <Play className="w-3 h-3" />
            {isStarting ? 'Starting...' : 'Start Agent'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
