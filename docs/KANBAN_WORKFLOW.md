# Kanban Workflow Guide

This document walks through the Code-Automata Kanban workflow using screenshots. Tasks progress through five phases: **Planning** → **In Progress** → **AI Review** → **Human Review** → **Done**.

---

## 1. Select Project

On startup, select a project folder to work with. The project must be a git repository. Recent projects are listed for quick re-selection.

![Select Project](../public/00-select-project.png)

---

## 2. Planning

Create a new task and add it to the Kanban board. The task enters the **Planning** phase, where the AI generates clarifying questions or an implementation plan based on your description.

![Planning](../public/01-planning.png)

---

## 3. Planning Q&A

If the AI needs clarification, it presents questions. Answer them to help refine the plan. You can select predefined options or provide custom answers. Use **Next** to proceed, **Skip** to bypass, or **Previous** to go back.

![Planning Q&A](../public/02-planning-QnA.png)

---

## 4. Review Implementation Plan

Once the AI generates a plan, review it before development starts. You can **Modify Plan** to request changes, **Only Approve** to accept as-is, or **Approve & Start** to approve and immediately begin development.

![Review Implementation Plan](../public/03-planning-human-review.png)

---

## 5. AI Development Start

After approval, the task moves to **In Progress**. The AI agent begins executing development subtasks in an isolated git worktree. Progress is shown on the task card.

![AI Development Start](../public/04-ai-development-start.png)

---

## 6. AI Subtask Execution

The task modal shows development subtasks with their status (pending, in progress, completed). You can monitor progress and use **Skip current** if needed. The agent works through each subtask sequentially.

![AI Subtask Execution](../public/05-ai-subtask-execution.png)

---

## 7. AI Review (QA)

When development subtasks complete, the task moves to **AI Review**. The AI runs QA subtasks for code review and verification, then executes automated checks (typecheck, build, lint) in the worktree.

![AI Review QA](../public/06-ai-review-QA.png)

---

## 8. AI QA Subtasks Execution + Automated Checks

QA subtasks are executed similarly to development. The modal shows verification steps with their completion status. After QA subtasks complete, automated checks run:

- **Typecheck**: Runs `yarn/npm/pnpm typecheck` or `tsc --noEmit`
- **Build** (if present): Runs `yarn/npm/pnpm build`
- **Lint** (if present): Runs `yarn/npm/pnpm lint`

**If checks pass**: Task moves to Human Review  
**If checks fail** (and rework count < 2): Task moves back to In Progress with a rework subtask containing failure details. The orchestrator re-runs dev → QA → checks automatically.  
**If at rework cap**: Task moves to Human Review with note "QA issues remain; please review manually"

![AI QA Subtasks Execution](../public/07-ai-qa-subtasks-execution.png)

---

## 9. Human Review

Once QA passes, the task moves to **Human Review**. The task card shows **Ready for human review**. Open the task to review changes, run tests locally, or create a merge request.

![Human Review](../public/08-human-review.png)

---

## 10. Human Review – Create MR or Review Locally

In the Human Review modal, you can:

- **Create MR** — Push changes and create a merge request for code review
- **Review Locally** — Open Cursor or VS Code at the task worktree, or open the folder in the file manager

![Human Review Merge Request](../public/09-human-review-merge-request.png)

---

## 11. GitHub Merge Request

After creating a merge request, the branch is pushed to GitHub. The PR can be reviewed, discussed, and merged. The branch name follows the pattern `code-automata/task-{id}`.

![GitHub Merge Request](../public/10-github-merge-request.png)

---

## 12. Task Done

When you **Move to Done** (or merge the PR and complete the workflow), the task moves to the **Done** column. It shows a **Completed** badge and full progress.

![Task Done](../public/11-task-done.png)

---

## 13. View Subtasks in Done State

Completed tasks remain in the Done column. Open any task to view its completed subtasks, logs, and implementation details.

![View Subtasks in Done State](../public/12-view-subtasks-in-done-state.png)

---

## Summary

| Phase            | Description                                                                             |
| ---------------- | --------------------------------------------------------------------------------------- |
| **Planning**     | Create task, answer questions, review and approve plan                                  |
| **In Progress**  | AI executes development subtasks in isolated worktree                                   |
| **AI Review**    | AI runs QA subtasks + automated checks (typecheck/build/lint); loops on failure (max 2) |
| **Human Review** | Review changes, create MR, or test locally                                              |
| **Done**         | Task completed, ready for merge or archival                                             |
