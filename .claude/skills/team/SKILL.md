---
name: team
description: Run the Ledgerly agent team on a task. The main session coordinates the ui-developer, qa-tester and bug-fixer subagents, reviews the result and reports back.
argument-hint: <what to build or change>
disable-model-invocation: true
---

# Ledgerly team

Task: $ARGUMENTS

You are the main agent. You coordinate, review and report. Subagents do the building, testing and fixing, and only you merge. If the task is empty or too unclear to write acceptance criteria for, ask the user before starting.

## 1. Set up
1. Read the `AGENTS.md` sections for this task.
2. Write short, testable acceptance criteria. Ask the user first if the task would change an agreed §11 dashboard formula or needs a new dependency.
3. Make sure the working tree is clean. If it isn't, stop and ask.
4. Create a local branch from `develop`: `git checkout -b feature/<short-name> develop`. Never push it.

Tell the user the criteria and branch name, then carry on.

## 2. Build
Start `ui-developer` with `isolation: "worktree"`, from the feature branch. Give it the task, the criteria, the branch context and the commit attribution line. When it finishes, check its report and merge its branch into the feature branch.

## 3. Test
Start `qa-tester` with `isolation: "worktree"`, from the feature branch. Give it the criteria and what changed, including the developer's unchecked items. Read every bug and drop only those you can show are wrong, noting why for the final report.

Merge any tests QA added. Check first that they only touch `src/lib/__tests__/`.

## 4. Fix and re-test
If QA reports bugs, give the full reports to `bug-fixer` with `isolation: "worktree"`, and merge its branch. Then send `qa-tester` the bug list and the fixer's report to re-test. Fix every Critical, High and Medium bug, and Low bugs when the fix is simple.

**Stop after 3 fix rounds.** Report anything still open instead of looping. Also stop and ask if a bug needs a product decision.

## 5. Review
Do this yourself, even if QA passed:
1. Read the full `git diff develop...HEAD`.
2. Check it against each criterion and against §11 and §14: user scoping on every query, card, loan and transfer rules, money helpers, and confirm dialogs.
3. Look for scope creep, duplicated logic, leftover debug code, and missing `AGENTS.md` updates.
4. On the feature branch, run `npx tsc --noEmit`, `npm run lint`, `npm test` and the scratch production build from §16.
5. Send anything you find back through step 4; those rounds count toward the limit of 3.

## 6. Report to the user
Give:
- **Result:** ready to try, or not, in one sentence
- **What was built,** in plain language
- **Checks and tests:** what ran, with real results
- **Bugs:** how many QA raised, how many were fixed, and what's still open
- **Not tested:** including the manual browser checks QA listed
- **Your feedback:** your honest view of the code and UX, including weak spots and suggested follow-ups
- **How to try it:** the branch name and `npm run dev`. Warn that local dev uses the real shared database, so they should use a test account.

Then stop. Merging to `develop` or `main` needs the user's explicit go-ahead.

## Rules
- Subagents must never use `.env.local` or the real database, push, or touch `develop` or `main`.
- Never report a check as passing unless it ran and passed. Give failures and gaps plainly.
- Remove any leftover worktrees, temporary databases and test servers before finishing. Delete a subagent's branch only after its work is merged.
