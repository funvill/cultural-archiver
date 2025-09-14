# Questions: Update Mass Import Endpoint

This document tracks the questions and answers used to refine the PRD for the "Update Mass Import Endpoint" feature.

## Section 1: Deduplication System Refinements

**1. What is the primary objective of the deduplication system?**
- A. To prevent any duplicate content by default, but allow fine-tuning of the scoring system to balance accuracy with performance. It should prioritize preventing duplicates over all else.

> Answer: A

**2. How should the system behave when a duplicate is detected with a high confidence score?**
- A. Automatically reject the new record and merge any new, non-conflicting metadata (like tags) into the existing record.

> Answer: A

**3. What is the most critical factor for identifying a duplicate artwork?**
- A. GPS location, as it's the strongest indicator of a physical object's uniqueness. Title and artist name are strong secondary factors.

> Answer: A

**4. How should the confidence scoring for deduplication be configured?**
- A. Use the weights defined in the PRD as a default, but allow them to be overridden in the `config` object of the API request for flexibility.

> Answer: The endpoint should accept the weights from the cli tool as parameters, if the weights don't exist use hard coded defaults

**5. When merging tags from a duplicate record, what should happen if a tag with the same label already exists on the original record?**
- A. Keep the original tag's value and discard the new one, ensuring the earliest data is preserved.

> Answer: A

## Section 2: Artist Auto-Creation and Linking

**6. What is the primary trigger for creating a new artist record automatically?**
- C. Only when a specific flag `createMissingArtists: true` is set in the import configuration.

> Answer: C

**7. How should the system handle an artwork with multiple artist names listed?**
- A. Check each name against the database. For each name that doesn't have a strong match, create a new, separate artist record.

> Answer: A

**8. What information should be included in an auto-created artist record?**
- A. Only the artist's name and a tag indicating it was auto-created from an artwork import, including the source artwork's ID for traceability.

> Answer: A

**9. If an artwork's artist name is a very close but not exact match to an existing artist (e.g., "John Smith" vs. "Jon Smith"), how should the system proceed?**
- A. Assume it's the same person and link the artwork to the existing artist record with the closest match, provided the similarity score is above a high threshold (e.g., 95%).

> Answer: A

**10. What should be the relationship between an artwork and its artist(s) in the database?**
- C. A separate linking table (`artwork_artists`) should be used to manage the relationships.

> Answer: C

## Section 3: Photo and Data Handling

**11. How should the system handle photo URLs provided in the import data?**
- A. The endpoint should be responsible for downloading each photo from its URL, uploading it to the project's R2 storage bucket, and then associating the new R2 URL with the artwork record.

> Answer: A

**12. What should happen if a photo URL is invalid, unreachable, or fails to download?**
- A. The artwork should still be created successfully, but the failed photo should be logged in the response's audit trail. The import process for that record should not be halted.

> Answer: A

**13. What is the purpose of storing the `originalData` from the plugin in the `old_data` field of the `submissions` table?**
- A. To provide a complete audit trail and allow for full traceability back to the original source data, which is essential for debugging and data verification.

> Answer: I don't know

**14. How should the system handle large text fields, such as an artist's biography or a detailed artwork description?**
- A. Accept the text as-is, but enforce a reasonable character limit (e.g., 10,000 characters) and sanitize it to prevent security issues like XSS.

> Answer: A

**15. What should be the default behavior for the `enableTagMerging` configuration option?**
- B. It should default to `false` to prevent any unintentional changes to existing records.

> Answer: B

## Section 4: Error Handling and API Response

**16. How should the final API response be structured, especially concerning errors?**
- A. The response should provide a clear, high-level summary (totals for success, failure, duplicates) and then detailed arrays for each outcome, including specific error messages and validation failures for each failed record.

> Answer: A

**17. If one record in a batch fails, what should happen to the rest of the batch?**
- A. The system should continue processing the rest of the records in the batch. The overall import is considered a partial success, with details of the failure(s) reported in the response.

> Answer: A

**18. How should database transactions be managed during the import?**
- A. Each record (artwork or artist) should be processed in its own individual transaction to ensure that a failure in one record doesn't affect others.

> Answer: A

**19. How specific should validation error messages be?**
- A. Very specific. They should include the field that failed, a human-readable error message, and a machine-readable error code (e.g., `{'field': 'lat', 'message': 'Latitude must be between -90 and 90', 'code': 'COORDINATES_OUT_OF_RANGE'}`).

> Answer: A

**20. What is the primary purpose of the `importId` in the request metadata?**
- A. To serve as a unique identifier for the entire import operation, allowing for comprehensive logging and traceability. All logs and audit trail entries related to the batch should be tagged with this ID.

> Answer: I don't know

## Section 5: Security and Authorization

**21. Who should be authorized to use this mass import endpoint?**
- A. Only authenticated users with a specific role of `admin` or `moderator`. This ensures that only trusted internal developers can perform mass imports.

> Answer: A

**22. What is the purpose of the `defaultUserToken` in the configuration?**
- A. To attribute all created records to a single, designated system user, making it easy to identify and manage all mass-imported content.

> Answer: A

**23. How should the system handle potentially malicious content in text fields (e.g., JavaScript in a description)?**
- A. All text fields should be sanitized on the server-side to remove any potential HTML or script tags, preventing XSS vulnerabilities.

> Answer: A

**24. What is the main security consideration for the photo download feature?**
- A. Preventing Server-Side Request Forgery (SSRF) by validating that photo URLs point to legitimate image files on public, standard ports (80/443) and not internal network resources.

> Answer: I don't know

**25. Since the endpoint is for internal use, what level of input validation is necessary?**
- A. The same strict validation as any public-facing endpoint. All data should be treated as untrusted, even from internal sources, to maintain data integrity and security.

> Answer: A

## Section 6: Performance and Scalability

**26. The PRD specifies a small batch size (max 10). What is the primary reason for this constraint?**
- B. It's a temporary limitation that we expect to increase significantly after initial testing.

> Answer: B

**27. If an import batch takes longer than the 10-minute timeout, what is the expected behavior?**
- A. The server should terminate the connection and return a timeout error. Any records that were successfully processed *before* the timeout should remain committed to the database, as each is handled in its own transaction.

> Answer: A, this should be much smaller then 10 mins. use configuration of 1 min

**28. How should the deduplication process query the database to find potential matches without causing performance bottlenecks?**
- A. Primarily by using an indexed spatial query (on latitude/longitude) to first narrow down the search to a small geographic area, and only then performing more intensive comparisons (like title/name matching) on that small subset.

> Answer: A

**29. What is the most significant factor expected to impact the memory usage of this endpoint?**
- A. The photo processing. Downloading image files from external URLs and holding them in memory before uploading them to the R2 bucket is the most memory-intensive part of the operation.

> Answer: A

**30. If the need arises in the future to import a very large dataset (e.g., 100,000+ records), what would be the expected architectural approach?**
- A. This would be considered out of scope for this synchronous API endpoint. A separate, dedicated asynchronous batch processing system (e.g., using queues and background workers) would need to be designed and built for that scale.

> Answer: A

## Section 7: Configuration and Flexibility

**31. How should the deduplication `duplicateThreshold` be handled if not provided in the request?**
- A. It should default to a sensible, hardcoded value (e.g., `0.7`) within the endpoint. This provides a consistent baseline behavior while still allowing for overrides.

> Answer: A

**32. What is the purpose of the `config` object in the API request?**
- A. To allow the client (the CLI tool) to override the endpoint's default behaviors for a specific import, providing run-time flexibility for things like the duplicate threshold and artist creation.

> Answer: A

**33. Should the endpoint support a "dry run" mode?**
- D. This should be handled exclusively by the CLI tool before it even calls the API.

> Answer: D

**34. How should the API handle unknown or unsupported fields in the request payload?**
- C. Log a warning but continue processing the request.

> Answer: C

**35. Should the behavior of creating missing artists be configurable?**
- A. Yes, the `createMissingArtists: true` flag in the `config` object should control this. If `false`, artworks with unknown artists should be flagged with a specific warning/error.

> Answer: A

## Section 8: Auditing and Logging

**36. What is the primary purpose of the audit trail returned in the API response?**
- A. To provide the calling client (the CLI tool) with immediate, actionable feedback on the outcome of the import, including which records were created, which were duplicates, and which failed.

> Answer: A

**37. Beyond the API response, what level of detail should be logged on the server for each import batch?**
- C. Only errors and failures.

> Answer: C

**38. How should server-side logs be structured to facilitate debugging and analysis?**
- B. As plain text lines.

> Answer: B

**39. When a duplicate is found and its tags are merged into an existing record, what specific information should be logged?**
- C. Only the count of tags that were merged.

> Answer: C

**40. Should successful photo downloads and uploads be logged individually?**
- D. This should only be logged in "verbose" or "debug" mode.

> Answer: D

## Section 9: Finalizing Scope and Non-Goals

**41. Which of these potential features is explicitly out of scope for this PRD?**
- A. A web-based user interface for running imports. This PRD is strictly for the backend API endpoint that the CLI tool will use.

> Answer: A

**42. Should the mass import endpoint support updating existing records (aside from tag merging on duplicates)?**
- A. No. The endpoint's purpose is to create new artwork and artist records. Updates to existing content should be handled by a separate, dedicated `PATCH` endpoint and submission workflow.

> Answer: A, PATCH endpoint is out of scope

**43. What is the expected relationship between the mass import CLI tool and this API endpoint?**
- A. The CLI tool is the *only* client that should be interacting with this endpoint. The endpoint is designed specifically to serve the needs of the CLI.

> Answer: A

**44. Should the endpoint support any data transformation or mapping?**
- A. No. The endpoint should expect clean, validated `RawImportData`. All data mapping, transformation, and cleaning from the original source format is the exclusive responsibility of the CLI plugins.

> Answer: A

**45. What is the policy on deleting records via this endpoint?**
- A. Deletion is strictly out of scope. This endpoint is for creation only. A separate, secure administrative endpoint should handle any deletion operations.

> Answer: A

## Section 10: Success Metrics and Final Verification

**46. What is the single most important metric for defining the success of this new endpoint?**
- A. Data Integrity: The endpoint successfully prevents duplicate records while correctly creating new ones, with 100% traceability back to the source data.

> Answer: A

**47. How will we measure the effectiveness of the deduplication algorithm?**
- A. By running a curated test dataset with known duplicates through the endpoint and asserting that the number of duplicates detected matches the number expected, with a target accuracy of >98%.

> Answer: A. We will also run the same import script multiple times, the subsequent runs should all produce duplicates.

**48. What defines a "successful" import operation from the client's perspective?**
- A. A `200 OK` response that contains a clear summary of what succeeded, what failed, and what was a duplicate, allowing the client to take appropriate follow-up action (like logging failures).

> Answer: A with a 201 created

**49. What is the primary indicator that the artist auto-creation feature is working correctly?**
- A. When importing an artwork with a new artist, the response correctly reports the creation of a new artist record, and the new artwork is correctly linked to the new artist's ID.

> Answer: A

**50. After the initial implementation, what would be the most likely area for future improvement?**
- A. The deduplication algorithm. The scoring weights and logic will likely require ongoing tuning and refinement as we encounter more diverse and complex datasets.

> Answer: A
