'use client';

/**
 * Sidebar Navigation
 *
 * Left sidebar with project navigation and tools (matching Auto-Claude)
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Terminal,
  ListTodo,
  Settings,
  GitBranch,
  GithubIcon,
  Brain,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NewTaskModal } from '@/components/tasks/new-task-modal';

const projectLinks = [
  { href: '/', label: 'Kanban Board', icon: LayoutDashboard },
  { href: '/agents', label: 'Agent Terminals', icon: Terminal },
  { href: '/tasks', label: 'Task List', icon: ListTodo },
  { href: '/settings', label: 'Settings', icon: Settings },
];

const toolLinks = [
  { href: '/github', label: 'GitHub Issues', icon: GithubIcon },
  { href: '/worktrees', label: 'Git Worktrees', icon: GitBranch },
  { href: '/memory', label: 'Memory/Context', icon: Brain },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);

  return (
    <>
      <aside data-testid="sidebar" className="w-64 bg-slate-900 text-white flex flex-col h-screen">
      {/* Header */}
      <div data-testid="sidebar-header" className="p-4 border-b border-slate-800">
        <h1 className="text-lg font-bold">Code-Auto</h1>
        <p className="text-xs text-slate-400">Autonomous AI agents</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        {/* Project Section */}
        <div data-testid="project-section" className="p-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase mb-2 px-2">
            Project
          </h2>
          <div className="space-y-1">
            {projectLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  data-testid={`nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-slate-800 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Tools Section */}
        <div data-testid="tools-section" className="p-3">
          <h2 className="text-xs font-semibold text-slate-400 uppercase mb-2 px-2">
            Tools
          </h2>
          <div className="space-y-1">
            {toolLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  data-testid={`nav-${link.label.toLowerCase().replace(/\s+/g, '-').replace('/', '-')}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                    isActive
                      ? "bg-slate-800 text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* New Task Button */}
      <div className="p-4 border-t border-slate-800">
        <Button
          data-testid="new-task-button"
          onClick={() => setIsNewTaskModalOpen(true)}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-black font-medium"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Task
        </Button>
      </div>
    </aside>

    {/* New Task Modal */}
    <NewTaskModal
      open={isNewTaskModalOpen}
      onOpenChange={setIsNewTaskModalOpen}
    />
  </>
  );
}
