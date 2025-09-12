---
model: Gemini 2.5 Pro
description: 'Asks questions about a feature'
LastUpdate: 2025-Sep-11
Author: Steven Smethurst
---

The goal is to understand the "what" and "why" of the feature, not necessarily the "how" (which the developer will figure out)

- Ask me numbered questions continuing from the previouse set of questions
- Give multiple choice answers A,B,C,D. `A` should be the recommended choice
- If needed, provide details that are required to make a section.
- Show the questions in the chat, wait for the answers from the user, update the file.
- 

## Loop

- Ask 5 clarifying questions on a common theam that help define this feature
  - Each loop ask questions about a different part of the feature. For Example: Goals, Functional Requirements, User Stories, Non-Goals (Out of Scope), Design Considerations, Technical Considerations, Audience, etc...
- Update the output file with the answers to these questions
- Do NOT start implementing the feature. No code should change.

## Output

After answering each set of questions, update the output file with the answers to these questions.

- **Format:** Markdown (`.md`)
- **Location:** `${workspaceFolder}/tasks/`
- **Filename:** `questions-[feature-name].md`

Example: 

```
# Feature Definition: Global Stats and Leaderboards

This document outlines the requirements for the "Global Stats and Leaderboards" feature based on the clarifying questions answered.

## Intial feature description

When running the mass-import and a duplicate is found. Check the tags, add any new tags to the existing recored, don't overwrite the existing tags.

## 1. Goals & High-Level Vision

* **Primary Goal:** To increase user engagement and gamify contributions.
* **Primary Audience:** All public visitors and registered users.
* **Timeframes:** The page should support both "All-Time" and "Last 30 Days" views for stats and leaderboards.
* **User Identity:** Contributors will be identified by their unique user ID (UUID). A future enhancement will allow users to set a public nickname.
* **Location:** The feature will be accessible via a new, dedicated "Stats" page in the main application navigation.

```
