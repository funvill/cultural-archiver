# Mass-Import Plugin System - Q&A

This document tracks the questions and answers used to refine the PRD for the mass-import plugin system.

## Section 1: Goals & High-Level Vision

**1. What is the primary goal of the plugin system?**

- A. Standardize data import: Create a unified, repeatable process for importing data from various sources.
- B. Enable third-party contributions: Allow external developers to create and share their own importers.
- C. Simplify one-off imports: Focus on making it easy to run a single, unique import quickly.

> Answer: A, B

**2. Who is the primary user of this system?**

- A. Internal developers: For migrating existing datasets and managing new ones.
- B. Non-technical users: Via a future web-based UI for running imports.
- C. Third-party developers: Who will build and maintain their own plugins.

> Answer: A only internal devlopers.

**3. How critical is the initial data validation?**

- A. Optional: Validation can be skipped for trusted data sources to speed up imports.
- B. Recommended: The system should default to validating but allow it to be disabled.
- C. Essential: All data must be validated against a strict schema before being passed to the exporter. Invalid data should be logged and rejected.

> Answer: C

**4. What is the expected data volume for a typical import?**

- A. Small (< 1,000 records): The system can optimize for simplicity and load all data into memory.
- B. Medium (1,000 - 50,000 records): The system should be optimized for batch processing and memory efficiency.
- C. Large (> 50,000 records): The system must support streaming data from source to destination to handle very large datasets.

> Answer: B

**5. What should be the default behavior if no exporter is specified?**

- A. Fail with an error: The user must explicitly define a destination for the data.
- B. Default to "dry-run": Use the `console` exporter to show what would happen without actually exporting.
- C. Default to `json`: Create a JSON file in a default output directory.

> Answer: A

## Section 2: Importer & Exporter Functionality

**6. How should the system discover plugins?**

- A. Statically at build time: A script scans the `importers/` and `exporters/` directories and generates a manifest file.
- B. Dynamically at runtime: The CLI tool scans the directories for valid plugin files when it starts.
- C. Manual registration: Developers must explicitly add their plugin to a central registry file.

> Answer: C

**7. What should happen if an importer provides data that doesn't match the `UnifiedImportData` schema?**

- A. Halt the entire import: Stop processing immediately and report the schema violation.
- B. Skip the invalid record: Log the error, save the invalid record to the report, and continue with the next record.
- C. Attempt to auto-correct: The system should try to fix minor discrepancies (e.g., type coercion) before validating.

> Answer: A

**8. How should secrets (e.g., API keys) be managed for plugins?**

- A. Environment variables: Plugins will read configuration and secrets from the system's environment variables.
- B. Configuration files: Each plugin can have a dedicated, git-ignored config file for its secrets.
- C. Passed via CLI: Secrets are passed as command-line arguments (e.g., `--api-key "..."`).

> Answer: A

**9. What is the primary responsibility of an Exporter plugin?**

- A. Data transformation: It can perform final modifications to the data before sending it to the destination.
- B. Data transmission only: It should only be responsible for sending the data as-is to the destination API or file.
- C. Batching and rate-limiting: It should manage how many records are sent at once and handle API rate limits.

> Answer: B

**10. How should the system handle an exporter failing mid-process (e.g., API goes down)?**

- A. Rollback: If the destination supports transactions, attempt a rollback. If not, report the failure.
- B. Retry logic: Implement an exponential backoff retry mechanism for a configurable number of attempts.
- C. Halt and report: Stop the export, save the progress, and report which records were successfully exported and which were not.

> Answer: C

### Section 3: CLI and Reporting

**11. How should a user specify which importer and exporter to use?**
> Answer: A. Via command-line arguments: `mass-import --importer vancouver --exporter api`

**12. What should be the standard output in the console during an import?**
> Answer: A useful output for unit testing. (Interpreted as Minimal: Only show a final summary message upon completion or failure.)

**13. How should the final JSON report be generated?**
> Answer: A. Automatically for every run: A report file is always created with a timestamp in the filename.

**14. Where should the generated report be saved?**
> Answer: A. In a central `reports/` directory with a timestamped filename (e.g., `reports/2025-09-13-143000-vancouver-api.json`).

**15. Besides record status, what is the most important information to include in the JSON report?**
> Answer: A. Performance metrics: Total time, records per second, and memory usage.

### Section 4: Configuration, Errors, and Plugin Structure

**16. How should individual plugins be configured (e.g., setting a file path for a CSV importer)?**
> Answer: C. Each plugin has its own configuration file in the plugin's directory.

**17. What should happen if a user tries to run an importer that isn't in the manual registry?**
> Answer: B. The system should fail with an error listing all available importers.

**18. How should data conflicts be handled by an exporter (e.g., trying to import an artwork that already exists)?**
> Answer: A. The exporter should always overwrite the existing data. Duplicate data is handled by the mass-import endpoint.

**19. What is the minimum required documentation for a new plugin to be accepted into the registry?**
> Answer: A. A `README.md` file in its directory explaining its purpose, configuration, and data source.

**20. How should the `DataPipeline` orchestrator be implemented?**
> Answer: A. As a class that is instantiated with importer and exporter plugins for each run.

### Section 5: Testing, Quality, and Developer Experience

**21. What level of testing is required for a new plugin to be accepted into the registry?**
> Answer: A. No strict requirement; tests are encouraged but not mandatory.

**22. Will plugins be required to adhere to the project's existing ESLint and Prettier configurations?**
> Answer: A. Yes, all submitted plugin code must pass the project's linting and formatting checks.

**23. Should a CLI tool be provided to bootstrap a new plugin directory structure?**
> Answer: C. Provide a well-documented template directory in the repository instead of a CLI tool.

**24. Should the core `mass-import` library provide common data transformation utilities (e.g., for date conversion, string cleaning)?**
> Answer: C. Yes, create a comprehensive utility library that can be extended over time.

**25. How should versions of individual plugins be managed?**
> Answer: A. Plugins are not versioned individually; they are versioned along with the main application.
