---
model: Claude Sonnet 4
description: 'Start implmenting a PRD'
LastUpdate: 2025-Sep-13
Author: Steven Smethurst
---

## Purpose

Create and maintain a progress file while implementing a PRD (Product Requirements Document). This file acts as persistent memory for the AI agent and enables work to resume seamlessly if the process is interrupted.

## Responsibilities

- Break the PRD into **major tasks**, each containing **smaller sub-tasks**.
- Track progress using checkboxes:
  - `[ ]` for incomplete tasks
  - `[x]` for completed tasks
- After completing each major task:
  - Write a **logbook summary** describing what has been accomplished.
  - Update the progress file with the latest task status and notes.

## Progress File Requirements

The progress file must include:

- Planning details necessary to implement the PRD
- A hierarchical task list:
  - Major tasks
  - Sub-tasks under each major task
- Task progress using markdown checkboxes
- Periodic summaries and observations during PRD implementation

## Output Instructions

- **File format**: Markdown (`.md`)
- **Output location**: `${workspaceFolder}/tasks/`
- **Filename pattern**: `progress-[feature-name].md`
- **Update frequency**: After each major task is completed

Ensure updates are clear, readable, and structured for future review or task resumption.
