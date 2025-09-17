---
description: 'Fix a complex issue with memory'
LastUpdate: 2025-Sep-15
Author: Steven Smethurst
---

## Purpose

Create and maintain a progress file while resovling this. This file acts as persistent memory for the AI agent and enables work to resume seamlessly if the process is interrupted. This is a handoff document

## Responsibilities

- Break the task into **major tasks**, each containing **smaller sub-tasks**.
- Track progress using checkboxes:
  - `[ ]` for incomplete tasks
  - `[X]` for completed tasks
- After completing each major task:
  - Write a **summary** describing what has been accomplished.
  - Update the progress file with the latest task status and notes.
- The document should include enugh information that this task can be "handed off" to another devloper.


## Output Instructions

- **File format**: Markdown (`.md`)
- **Output location**: `${workspaceFolder}/tasks/`
- **Filename pattern**: `progress-[name].md`
- **Update frequency**: After each major task is completed

Ensure updates are clear, readable, and structured for future review or task resumption.
