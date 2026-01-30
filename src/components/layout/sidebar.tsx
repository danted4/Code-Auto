'use client';

/**
 * Sidebar Navigation
 *
 * Left sidebar with project navigation and tools (matching Code-Auto)
 */

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Terminal,
  ListTodo,
  Settings,
  GitBranch,
  GithubIcon,
  Brain,
  Plus,
  FolderOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NewTaskModal } from '@/components/tasks/new-task-modal';
import { OpenProjectModal } from '@/components/project/open-project-modal';
import { ThemeSwitcher } from '@/components/theme/theme-switcher';
import { useProjectStore } from '@/store/project-store';

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
  const [isOpenProjectModalOpen, setIsOpenProjectModalOpen] = useState(false);
  const projectPath = useProjectStore((s) => s.projectPath);

  return (
    <>
      <aside
        data-testid="sidebar"
        className="w-64 flex flex-col h-screen shrink-0 relative z-10"
        style={{
          background: 'var(--color-surface)',
          color: 'var(--color-foreground)',
          boxShadow: '4px 0 20px var(--color-sidebar-shadow)',
        }}
      >
        {/* Header */}
        <div
          data-testid="sidebar-header"
          className="p-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <h1 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
            Code-Auto
          </h1>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Autonomous AI agents
          </p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto">
          {/* Project Section */}
          <div data-testid="project-section" className="p-3">
            <div className="flex items-center justify-between mb-2 px-2">
              <h2
                className="text-xs font-semibold uppercase"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Project
              </h2>
              <button
                type="button"
                onClick={() => setIsOpenProjectModalOpen(true)}
                className="p-1 rounded hover:opacity-80"
                title="Open Project"
              >
                <FolderOpen className="w-3.5 h-3.5" style={{ color: 'var(--color-text-muted)' }} />
              </button>
            </div>
            {projectPath && (
              <p
                className="text-xs px-2 mb-2 truncate"
                style={{ color: 'var(--color-text-muted)' }}
                title={projectPath}
              >
                {projectPath.split('/').pop() || projectPath}
              </p>
            )}
            <div className="space-y-1">
              {projectLinks.map((link) => {
                const Icon = link.icon;
                const isActive = pathname === link.href;

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-testid={`nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{
                      background: isActive ? 'var(--color-background)' : 'transparent',
                      color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--color-background)';
                        e.currentTarget.style.color = 'var(--color-text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                      }
                    }}
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
            <h2
              className="text-xs font-semibold uppercase mb-2 px-2"
              style={{ color: 'var(--color-text-muted)' }}
            >
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
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
                    style={{
                      background: isActive ? 'var(--color-background)' : 'transparent',
                      color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--color-background)';
                        e.currentTarget.style.color = 'var(--color-text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                      }
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Footer */}
        <div className="border-t" style={{ borderColor: 'var(--color-border)' }}>
          {/* Theme Switcher */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
            <h3
              className="text-xs font-semibold uppercase mb-3"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Theme
            </h3>
            <ThemeSwitcher />
          </div>

          {/* New Task Button */}
          <div className="p-4">
            <Button
              data-testid="new-task-button"
              onClick={() => {
                if (!projectPath) {
                  setIsOpenProjectModalOpen(true);
                } else {
                  setIsNewTaskModalOpen(true);
                }
              }}
              className="w-full font-medium"
              style={{
                background: 'var(--color-primary)',
                color: 'var(--color-primary-text)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--color-primary-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--color-primary)';
              }}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Button>
          </div>
        </div>
      </aside>

      {/* New Task Modal */}
      <NewTaskModal open={isNewTaskModalOpen} onOpenChange={setIsNewTaskModalOpen} />

      {/* Open Project Modal */}
      <OpenProjectModal open={isOpenProjectModalOpen} onOpenChange={setIsOpenProjectModalOpen} />
    </>
  );
}
