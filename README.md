# Code-Auto

Code-Auto is a Next.js app for running “AI coding tasks” through a 5-phase Kanban workflow, with **one git worktree + branch per task** for isolation.

## What it does
- **Workflow**: `planning → in_progress → ai_review → human_review → done`
- **Isolation**: per-task worktrees in `.code-auto/worktrees/{taskId}/` with branch `auto-claude/{taskId}`
- **Pluggable execution**: a `CLIAdapter` layer (currently **Mock** + **Amp SDK**)
- **Live logs**: agent output streamed to the UI via SSE
- **File-based storage**: tasks stored as JSON in `.code-auto/tasks/`

## Current status
The authoritative current state + backlog lives in **`IMPLEMENTATION_PLAN.md`**.

## Quick start

### Prerequisites
- Node.js 18+
- Git (required for worktrees)

### Install
```bash
npm install
```

### Run
```bash
npm run dev
```

### Tests
```bash
npm run test:e2e
```

## Using real Amp (optional)
This project includes an Amp SDK adapter (`@sourcegraph/amp-sdk`). For real runs:

- Set `AMP_API_KEY` in your environment, **or** authenticate via `amp login` (if you use the Amp CLI).

## Repo map (high-signal)
- **Adapters**: `src/lib/cli/*`
- **Agent manager**: `src/lib/agents/manager.ts`
- **Worktrees**: `src/lib/git/worktree.ts`
- **Tasks + persistence**: `src/lib/tasks/*`
- **API routes**: `src/app/api/*`
- **UI**: `src/components/*`

## Documentation
- `IMPLEMENTATION_PLAN.md` — master plan (single source of truth)

## License
See `LICENSE`.

