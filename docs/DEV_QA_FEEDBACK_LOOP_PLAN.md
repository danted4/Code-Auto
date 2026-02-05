# Dev + QA Feedback Loop — Plan (in-repo snapshot)

## Automated checks (source of truth)

Automated checks run in the **task worktree** after QA subtasks complete. Implementation: `src/lib/agents/qa-automated-checks.ts`.

- **Commands (in order):** typecheck (script `typecheck` or `npx tsc --noEmit`), build (script `build` if present), lint (script `lint` if present).
- **Package manager:** Detected from lockfile (`yarn.lock`, `pnpm-lock.yaml`, else npm).
- **Result:** Pass/fail plus summary and details; only non-zero exit codes trigger the rework loop. Manual QA and `manual-qa-required/` files do **not** trigger the loop.

## QA agent responsibilities (beyond automated checks)

The QA phase must do two extra things in addition to any automated checks:

1. **Code review:** Review the code for:
   - Errors and syntax issues
   - Runtime problems that can arise  
     Report findings (e.g. in QA output or a structured result). For this phase, only **automated check exit codes** trigger the loop; the QA prompt should still require this review so the agent produces useful findings (and we can later allow QA-written “fail” to trigger rework if desired).

2. **Plan–code harmony:** Double-check that the implementation matches the approved plan and report any mismatch.

**Implementation:** The QA subtask prompt (`src/lib/agents/qa-subtask-prompt.ts`) and shared QA context instruct the agent to (1) review code for errors/syntax/runtime issues and (2) verify plan and code are in harmony. Context includes the list of completed dev subtasks and the approved plan.

---

## Testing the loop

**Happy path (no rework):** Create a task, approve plan, start development. Watch the card: Planning → In Progress (dev subtasks) → AI Review (QA subtasks) → Human Review when typecheck/build/lint pass. Logs: `.code-automata/tasks/{taskId}/development-logs.txt` and `review-logs.txt`; look for `[Automated checks] pass: ...`.

**Rework path (force a failure):** To see the card move back to In Progress and the rework subtask without relying on a real failure:

1. Set `CODE_AUTOMATA_QA_FORCE_FAIL=1` in the environment where the app runs (e.g. in the terminal before `yarn start`, or in your Electron/Next run script).
2. Create a task, approve plan, start development.
3. After dev and QA subtasks complete, automated checks will **simulate** a failure, so the orchestrator will add a "Rework (1/2)" dev subtask, set the card back to In Progress, run that rework, then run QA again, then run real checks (or simulated again if the env is still set).
4. To see a second rework and then the cap: leave the env set; after 2 rework cycles the task will move to Human Review with a note "QA issues remain; please review manually".
5. Unset `CODE_AUTOMATA_QA_FORCE_FAIL` for normal use.

**Rework path (real failure):** Use a task whose changes will fail typecheck or lint (e.g. add a type error in the worktree). The first run will fail checks, and you’ll see the same rework flow with real failure output in `qaFailureFeedback`.

---

## Rest of the plan

For schema, orchestrator, dev rework context, QA context (list of completed dev subtasks), rework cap, and implementation order, see the main plan (e.g. in Cursor’s plan file or the “Dev + QA Feedback Loop” overview). This file records the **automated checks source** and **QA code-review + plan–code harmony** decisions. Schema, orchestrator, and rework cap are implemented as in the main plan.
