---
model: Gemini 2.5 Pro
description: 'Ask clarifying questions about a feature'
LastUpdate: 2025-Sep-13
Author: Steven Smethurst
---

# Purpose

The goal is to understand the **"what"** and **"why"** of the feature, not the **"how"**. Implementation details (the "how") will be handled later by developers.

# Instructions

- Ask me **numbered questions**, continuing from the previous set.
- Provide **multiple-choice answers (A, B, C, D)**.
  - `A` should always be the **recommended choice**.
- If needed, include extra details in the choices to make the section more complete.
- Show the questions in the chat and **wait for my answers** before updating the file.
- After each set of answers, **update the output file** with the new information.
- Continue asking questions until I explicitly say "stop."

# Loop

For each cycle:

1. Ask **20 clarifying questions** on a single theme that helps define the feature.  
   Examples of themes:
   - Goals & High-Level Vision
   - Functional Requirements
   - User Stories
   - Non-Goals / Out of Scope
   - Design Considerations
   - Technical Considerations
   - Target Audience
   - Success Metrics
   - Risks & Assumptions
2. Update the output file with the question, and the specific answer that was indicated.
3. Do **not** implement or generate code. This step is purely about requirements gathering.

# Output

- After each set of answered questions, append the output file.
- **Format:** Markdown (`.md`)
- **Location:** `${workspaceFolder}/tasks/`
- **Filename:** `questions-[feature-name].md`
