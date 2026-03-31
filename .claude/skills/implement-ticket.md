---
name: implement-ticket
description: "Implement a Linear ticket by ID: fetch → plan → build → review"
---

# Ticket Implementation Workflow

When asked to implement a Linear ticket (e.g., "implement ENG-72", "pick up ENG-72"):

## Step 1: Fetch & Understand
Launch `ticket-implementer` agent with the ticket ID.
The agent will:
- Fetch the issue from Linear
- Explore relevant codebase patterns
- Present an implementation plan
- Write the code

## Step 2: Review
After implementation, launch `code-reviewer` on all changed files.

## Step 3: Branch & Commit
- Create branch: `sankalans/eng-{number}-{slug}` (use the `gitBranchName` from Linear)
- Commit with a message referencing the ticket: "ENG-{number}: {description}"

## Step 4: Update Linear
Update the Linear issue status to "In Progress" when starting, "Done" when complete.
