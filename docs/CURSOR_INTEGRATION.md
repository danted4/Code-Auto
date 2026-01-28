# Cursor Agent CLI Integration

This document describes the full Cursor Agent CLI integration in Code-Auto, providing feature parity with the Amp SDK adapter.

## Overview

The **CursorAdapter** enables Code-Auto to orchestrate tasks using the Cursor Agent CLI instead of (or alongside) the Amp SDK. Both adapters support the same 5-phase workflow, JSON-based planning/subtask generation, and validation feedback loops.

## Prerequisites

### 1. Install Cursor Agent CLI

The Cursor Agent CLI should be installed and available on your PATH:

```bash
which agent
# Should return: /Users/yourname/.local/bin/agent (or similar)
```

If not installed, download from [cursor.sh](https://cursor.sh) and follow installation instructions.

### 2. Authenticate

Authenticate using one of these methods (CLI login preferred):

**Option A: CLI Login (Preferred)**
```bash
agent login
```

Verify authentication:
```bash
agent status
# Should show: ✓ Logged in as your@email.com
```

**Option B: API Key Environment Variable**
```bash
export CURSOR_API_KEY="your-api-key-here"
```

### 3. Verify Readiness

Start the dev server and check the preflight endpoint:

```bash
curl http://localhost:3000/api/cursor/preflight | jq
```

Expected response when ready:
```json
{
  "agentCliPath": "/Users/yourname/.local/bin/agent",
  "authSource": "cli_login",
  "canRunCursor": true,
  "instructions": [],
  "diagnostics": {
    "hasEnvApiKey": false,
    "cliLoginDetected": true,
    "statusOutput": "✓ Logged in as your@email.com"
  }
}
```

## How It Works

The CursorAdapter uses the following CLI flags to integrate seamlessly:

| Flag | Value | Purpose |
|------|-------|---------|
| `--print` | (flag) | Non-interactive mode for scripts/automation |
| `--output-format` | `stream-json` | Structured streaming output (newline-delimited JSON) |
| `--mode` | `plan` (planning only) | Read-only mode during planning phase (no file edits) |
| `--workspace` | `{worktreePath}` | Set working directory to task's isolated worktree |
| `--model` | `sonnet-4`, `gpt-5`, etc. | Choose specific AI model |
| `--resume` | `{chatId}` | Resume previous session (thread continuity) |

## Workflow Phases

### Phase 1: Planning

**Without Human Review (Auto-Plan):**
```bash
agent --print --output-format stream-json --mode plan --workspace .code-auto/worktrees/task-xxx "Generate implementation plan..."
```

The agent returns JSON:
```json
{
  "plan": "# Implementation Plan\n\n## Overview\n..."
}
```

**With Human Review:**
First generates questions:
```json
{
  "questions": [
    {"id": "q1", "question": "...", "options": [...], "required": true}
  ]
}
```

Then generates plan after user answers.

### Phase 2: Subtask Generation

```bash
agent --print --output-format stream-json --workspace .code-auto/worktrees/task-xxx "SUBTASK GENERATION..."
```

Returns:
```json
{
  "subtasks": [
    {
      "id": "subtask-1",
      "content": "Detailed description",
      "label": "Short label",
      "activeForm": "Working on...",
      "type": "dev"
    }
  ]
}
```

**Validation Loop:**
- If JSON is invalid or subtasks don't meet quality standards, CursorAdapter provides feedback and retries (up to 3 attempts)
- Same validation logic as AmpAdapter

### Phase 3: Development (Subtask Execution)

For each dev subtask:
```bash
agent --print --output-format stream-json --workspace .code-auto/worktrees/task-xxx --resume {chatId} "Execute subtask..."
```

Full write access enabled (no `--mode plan` flag).

### Phase 4: AI Review (QA Subtasks)

Same as development, but executes QA subtasks:
```bash
agent --print --output-format stream-json --workspace .code-auto/worktrees/task-xxx --resume {chatId} "Execute QA verification..."
```

### Phase 5: Human Review

The worktree contains all changes made by the Cursor agent, ready for PR creation or local review.

## Stream Message Format

The Cursor CLI with `--output-format stream-json` emits newline-delimited JSON:

```json
{"type": "text", "content": "I'm analyzing the codebase..."}
{"type": "tool_call", "tool_name": "Read", "tool_input": {"path": "src/app.ts"}}
{"type": "tool_result", "tool_name": "Read", "tool_output": "...file contents..."}
{"type": "text", "content": "Based on my analysis..."}
{"type": "end"}
```

The adapter maps these to Code-Auto's standard `StreamMessage` format:
- `text` → `assistant` message
- `tool_call` / `tool_result` → `tool` message
- `end` → `result` message
- `error` → `error` message

## Configuration

### Model Selection

Users can choose the AI model when creating a task:

| Model | Value | Description |
|-------|-------|-------------|
| Claude Sonnet 4 | `sonnet-4` | Default, balanced performance |
| GPT-5 | `gpt-5` | OpenAI's latest model |
| Claude Sonnet 4 (Thinking) | `sonnet-4-thinking` | Extended reasoning mode |

### Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `CURSOR_API_KEY` | API key for authentication | (none, use `agent login` instead) |
| `CURSOR_AGENT_CMD` | Override agent binary path | `agent` |

## Comparison: Amp vs Cursor

| Feature | Amp SDK | Cursor CLI | Mock |
|---------|---------|------------|------|
| **Interface** | Library (SDK) | Subprocess (CLI) | In-memory simulation |
| **Planning Mode** | Settings file | `--mode plan` flag | Simulated |
| **Streaming** | Async iterable | `stream-json` output | Async iterable |
| **Thread Resume** | Thread ID tracking | `--resume {chatId}` | Thread ID tracking |
| **Authentication** | `AMP_API_KEY` or `amp login` | `CURSOR_API_KEY` or `agent login` | None required |
| **Validation** | JSON extraction + feedback | JSON extraction + feedback | Mock JSON |
| **Workspace** | SDK option | `--workspace` flag | Config |
| **Max Concurrent** | 12 | 12 | 12 |

## Testing the Integration

### 1. Quick Smoke Test

Create a simple task with Cursor:

```bash
curl -X POST http://localhost:3000/api/tasks/create \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Cursor Test Task",
    "description": "Create a simple hello-world.md file",
    "cliTool": "cursor",
    "cliConfig": {"model": "sonnet-4"},
    "requiresHumanReview": false
  }'
```

Watch the logs to verify Cursor executes the task.

### 2. Full Workflow Test

1. Open Code-Auto UI: `http://localhost:3000`
2. Click "New Task"
3. Select "Cursor Agent (CLI)" from the dropdown
4. Verify the "Cursor readiness" panel shows "Ready"
5. Enter a task description
6. Uncheck "Require human review for plan"
7. Click "Start Task"
8. Watch the task flow through: `planning → in_progress → ai_review → human_review → done`

### 3. Verify Worktree Isolation

After a Cursor task completes:

```bash
# Check the task's worktree
ls .code-auto/worktrees/task-*/

# Verify changes are NOT in main repo
git status  # Should be clean

# Verify branch exists
git branch -a | grep code-auto/task-
```

## Troubleshooting

### Cursor CLI Not Found

```
Error: Cursor not ready.
- Install the Cursor Agent CLI so `which agent` returns a path.
```

**Fix:**
1. Install Cursor from [cursor.sh](https://cursor.sh)
2. Verify installation: `which agent`
3. Restart Code-Auto dev server: `yarn dev`

### Authentication Failed

```
Error: Cursor not ready.
- Run `agent login` to authenticate the CLI (preferred).
```

**Fix:**
```bash
agent login
# Follow browser prompts to authenticate
agent status  # Verify: ✓ Logged in
```

### JSON Parsing Errors During Planning

The adapter will automatically retry up to 3 times with validation feedback. If all attempts fail, the task moves to `blocked` status and logs show the validation errors.

**Manual Fix:**
1. Check planning logs: `.code-auto/tasks/{taskId}/planning-logs.txt`
2. Review the validation errors
3. Adjust the task description to be more specific
4. Restart planning

### Process Hangs During Execution

If the Cursor agent process hangs:

1. Check active processes: `ps aux | grep agent`
2. Kill manually if needed: `pkill -f "agent --print"`
3. Stop the agent via UI: Click "Pause" button on task card
4. Check logs for errors

## Architecture Notes

### Thread Management

- Each Code-Auto `threadId` maps to a Cursor chat session
- The adapter stores `threadId → chatId` mappings for resume support
- When a thread is resumed, `--resume {chatId}` is passed to maintain context

### Working Directory Isolation

- Each task's Cursor agent runs in its own worktree: `.code-auto/worktrees/{taskId}/`
- The `--workspace` flag ensures all file operations happen in the correct directory
- Multiple tasks can execute concurrently without interfering with each other

### Validation Feedback Loop

Same as Amp:
1. Agent returns output
2. CursorAdapter extracts and validates JSON
3. If invalid, generates feedback and re-prompts
4. Repeats up to 3 times
5. If validation never passes, task moves to `blocked` status

## Future Enhancements

- **Interactive mode support**: Detect when `agent` is running in interactive mode and gracefully fall back
- **Cost tracking**: Parse Cursor usage data if exposed via CLI
- **Advanced permissions**: Use Cursor's permission system (if available) instead of `--mode plan`
- **Multi-file context**: Leverage Cursor's `@file` syntax for better codebase understanding
