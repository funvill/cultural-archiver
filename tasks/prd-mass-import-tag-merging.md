# PRD: Mass Import Tag Merging

This document outlines the product requirements for handling tag merging during a mass import when a duplicate artwork is detected.

## 1. Feature Overview

The current mass import system identifies and skips duplicate artworks to prevent redundant entries. This feature enhances the duplicate detection process by merging tags from the imported record into the existing artwork record before discarding the duplicate. This enriches the existing data with new information from different sources without creating conflicting entries.

## 2. Goals

-   **Enrich Artwork Data:** Combine tags from multiple data sources into a single, comprehensive artwork record.
-   **Prevent Data Loss:** Avoid discarding potentially valuable tag information from duplicate import records.
-   **Maintain Data Integrity:** Ensure that tag merging follows specific rules to prevent conflicts and maintain consistency.
-   **Improve Efficiency:** Automate the process of data enrichment during the import process, reducing the need for manual updates.

## 3. Functional Requirements

### 3.1. Duplicate Detection

-   The system will continue to use the existing similarity service to identify duplicate artworks based on title, artist, location, and tags.
-   The `checkForDuplicate` method in `src/workers/lib/mass-import.ts` will be updated to return detailed information about the duplicate match, including the existing artwork's ID.

### 3.2. Tag Merging Logic

-   When a duplicate is detected, the system will retrieve the tags from both the existing artwork and the new import record.
-   It will then iterate through the new tags and add any that do not already exist on the existing record.
-   If a tag with the same `label` already exists, the system will keep the existing tag and discard the new one, preventing overwrites.

### 3.3. Data Handling

-   After the tags are merged, the imported artwork record will be discarded, and a "skipped" status will be logged.
-   The system will not create a new artwork entry for the duplicate record.

### 3.4. Logging and Reporting

-   The system will log a detailed message to the console indicating that a duplicate was found and that the tags were merged.
-   The log message will include the ID of the existing artwork and the number of new tags that were added.

## 4. Non-Functional Requirements

-   **Performance:** The tag merging process should not significantly impact the overall performance of the mass import. Database queries for retrieving and updating tags should be optimized.
-   **Scalability:** The solution should be able to handle large-scale imports with a high number of duplicates without performance degradation.
-   **Reliability:** The tag merging process must be reliable and not result in data corruption or inconsistencies.

## 5. Implementation Plan

1.  **Update `src/shared/mass-import.ts`:**
    -   Define a `MassImportDuplicateInfo` interface to carry the necessary information about the duplicate artwork.

2.  **Modify `src/workers/lib/mass-import.ts`:**
    -   Import `MassImportDuplicateDetectionService` and related types.
    -   Update the `checkForDuplicate` method to use the duplicate detection service and return the `MassImportDuplicateInfo`.
    -   In the `processBatch` method, add logic to handle the tag merging when a duplicate is found. This will involve fetching the existing artwork's tags, comparing them with the new tags, and updating the database with any new tags.

3.  **Testing:**
    -   Create unit tests to verify the tag merging logic, including the conflict resolution strategy.
    -   Perform integration testing with a sample dataset to ensure the end-to-end process works as expected.
