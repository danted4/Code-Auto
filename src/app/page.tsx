import { KanbanBoard } from '@/components/kanban/board';

export default function Home() {
  return (
    <div className="h-screen flex flex-col bg-slate-950">
      <KanbanBoard />
    </div>
  );
}
