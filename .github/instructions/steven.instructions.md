# Art of Steven 

This is a general instruction file of Steven best practices

## Quick rules (read me first)

- Read/update adgents/CURRENT_TASK.md each step; delete when done.
- Never write fallback code or mock data in the main source files.
- Timestamps should be in this format YYYY-MMM-DD-HHMMSS
- Use `const` express intent
- No clever tricks - choose the boring solution
  - Only use stable packages, never use latest versions unless its stable or has long term support.
- Fail fast with descriptive messages
- Logging: use info!/debug!/warn!/error! (no println, or console.log, etc...!); avoid per-frame logs unless trace!.



- The computer that Steven uses for code review and devlopment: Windows using powershell
  - PowerShell uses ; instead of &&. 
- Its common the that the project files are in a sub folder of the git project with the same name as the project. 

- Version numbers should have a 'build' number that automaticly incurments by the CI system.





- All output files, should include the applications name that generated that file, the version, and the timestamp of when that file was generated. 

- Functions should check parameters of the function at the top of the function
- Fail early in functions. The functions should have many places it fails, but only a few places that pass




- if C/C++ use GoogleTest, and makefiles

## GUI/ UX

- Always have a "Reset to defaults" button with a "Are you sure?" comformation dialog.
- Any destructive action should have a "Are you sure?" comformation dialog. For example if you are deleting a row in a table. 
- In general, Don't ask customers where to save files. Instead just save the file with a default file name that includes the current timestamp (YYYY-MMM-DD-HHMMSS), to the working directory. Then shell open the folder with the file to reveal the file. 
- Use icons and colors

## Logging

Good log messages are very importain. Its common that the only feedback we get from a customer is the logs. The logging system is one of the first things that should be set up. 

- Always set up a logging system that logs to both the console and the file system automaticly
- If logging to the file system, Log rotation must be built in
- Must support at lest these logging levels (debug, info, error)
- Logs should have a timestamp 
- Logs should have a service/script that the log message orginated from
- Any error message that is shown to the user should also be logged. This includes validataion
- The very first message in the log should be the version of the application. 

## CI / Github Actions workflow

- All projects should have a 'test' and a 'build and publish' Github Actions workflow. 
- 'Test' should run on every commit, and automaticly run the unit tests. 
- 'Build and publish' should run when a tag matches 'v*.*.*'. This should produce a Github project release.
  - As close as possiable to a "one button" publish. Make it easy to publish the project so it can happen more frequntly. 
  - Auto update the build number in the version from the CI system. 

## Change log 

- The ```CHANGELOG.MD``` lists a history of changes.
  - Update the changelog with any changes, reference the issue ID
  - Add the list of changes to the file in a "## Unreleased" section just below the "# Change Log" title. Do not include a date or version in this list of changes.

## Unit tests

- Store unit tests in the `/test/` folder
- Unit tests should be run using `npm run tests` and should be run often.

## Code Style

- Use **4 spaces** for indentation.
- Comments about what the file does at the top of the file
- Comments about what each function does above the function.
- Use full names for variables instead of i,j,k,etc... for example: offset

## NPM

- All package.json should have a 'test', and a 'start' script.
- Only use stable packages, never use latest versions unless its stable or has long term support.


## Perfered tech stack

When appropriate use this tech stack

- Typescript
- ElectronJS
- VueJS
- Tailwind css
- Googles Material Design
- Shadcn/UI


## Philosophy

### Core Beliefs

- **Incremental progress over big bangs** - Small changes that compile and pass tests
- **Learning from existing code** - Study and plan before implementing
- **Pragmatic over dogmatic** - Adapt to project reality
- **Clear intent over clever code** - Be boring and obvious

### Simplicity Means

- Single responsibility per function/class
- Avoid premature abstractions
- No clever tricks - choose the boring solution
- If you need to explain it, it's too complex

## Process

### 1. Planning & Staging

Break complex work into 3-5 stages. Document in `IMPLEMENTATION_PLAN.md`:

```markdown
## Stage N: [Name]
**Goal**: [Specific deliverable]
**Success Criteria**: [Testable outcomes]
**Tests**: [Specific test cases]
**Status**: [Not Started|In Progress|Complete]
```
- Update status as you progress
- Remove file when all stages are done

### 2. Implementation Flow

1. **Understand** - Study existing patterns in codebase
2. **Test** - Write test first (red)
3. **Implement** - Minimal code to pass (green)
4. **Refactor** - Clean up with tests passing
5. **Commit** - With clear message linking to plan

### 3. When Stuck (After 3 Attempts)

**CRITICAL**: Maximum 3 attempts per issue, then STOP.

1. **Document what failed**:
   - What you tried
   - Specific error messages
   - Why you think it failed

2. **Research alternatives**:
   - Find 2-3 similar implementations
   - Note different approaches used

3. **Question fundamentals**:
   - Is this the right abstraction level?
   - Can this be split into smaller problems?
   - Is there a simpler approach entirely?

4. **Try different angle**:
   - Different library/framework feature?
   - Different architectural pattern?
   - Remove abstraction instead of adding?

## Technical Standards

### Architecture Principles

- **Test-driven when possible** - Never disable tests, fix them

### Code Quality

- **Every commit must**:
  - Compile successfully
  - Pass all existing tests
  - Include tests for new functionality
  - Follow project formatting/linting

- **Before committing**:
  - Run formatters/linters
  - Self-review changes
  - Ensure commit message explains "why"

### Error Handling

- Fail fast with descriptive messages
- Include context for debugging
- Handle errors at appropriate level
- Never silently swallow exceptions

## Decision Framework

When multiple valid approaches exist, choose based on:

1. **Testability** - Can I easily test this?
2. **Readability** - Will someone understand this in 6 months?
3. **Consistency** - Does this match project patterns?
4. **Simplicity** - Is this the simplest solution that works?
5. **Reversibility** - How hard to change later?

## Project Integration

### Learning the Codebase

- Find 3 similar features/components
- Identify common patterns and conventions
- Use same libraries/utilities when possible
- Follow existing test patterns

### Tooling

- Use project's existing build system
- Use project's test framework
- Use project's formatter/linter settings
- Don't introduce new tools without strong justification

## Quality Gates

### Definition of Done

- [ ] Tests written and passing
- [ ] Code follows project conventions
- [ ] No linter/formatter warnings
- [ ] Commit messages are clear
- [ ] Implementation matches plan
- [ ] No TODOs without issue numbers

### Test Guidelines

- Test behavior, not implementation
- One assertion per test when possible
- Clear test names describing scenario
- Use existing test utilities/helpers
- Tests should be deterministic

## Important Reminders

**NEVER**:
- Use `--no-verify` to bypass commit hooks
- Disable tests instead of fixing them
- Commit code that doesn't compile
- Make assumptions - verify with existing code

**ALWAYS**:
- Commit working code incrementally
- Update plan documentation as you go
- Learn from existing implementations
- Stop after 3 failed attempts and reassess