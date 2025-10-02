# Data Collector - Burnaby Art Gallery: Clarifying Questions

This document records the clarifying questions and answers that define the requirements for the "Data Collector - Burnaby Art Gallery" feature.

## Goals & High-Level Vision

1. **Primary Goal:** What is the most accurate description of the primary objective for this data collection script?
    - **Answer (B):** Develop a script that can be run periodically to detect and import updates from the gallery's website.

2. **Data Scope:** What is the complete scope of data to be collected?
    - **Answer (A):** All 114 public artworks and their associated artists, as specified in the brief.

3. **Data Freshness:** How critical is it that the collected data is up-to-date?
    - **Answer (C):** The script should be designed to be re-run on a monthly basis to catch any updates.

4. **Error Handling Strategy:** What is the desired approach for handling missing data fields (e.g., an artwork with no listed medium)?
    - **Answer (A):** Omit the field from the JSON output but still process the record. Log a warning that includes the artwork's source URL and the missing field.

5. **Script Reusability:** What is the long-term vision for this script's reusability?
    - **Answer (B):** The script should be designed with modular components that could be adapted for future scrapers.

6. **Data Quality vs. Speed:** What is the main priority for the script's execution?
    - **Answer (A):** Data accuracy and completeness are paramount, even if the script takes longer to run.

7. **Success Metric:** What is the primary metric for determining if this project is successful?
    - **Answer (A):** A GeoJSON file is produced containing exactly 114 valid artwork features and all associated artist files, which passes the mass import system's validation.

8. **Maintenance & Ownership:** Who will be responsible for maintaining this script in the future?
    - **Answer (B):** The original developer is responsible for any future updates or bug fixes.

9. **Output Format Flexibility:** How strict is the requirement for the GeoJSON output format?
    - **Answer (A):** The format must strictly adhere to the example provided, as the mass import system depends on this exact structure.

10. **Image Handling:** What is the goal regarding artwork photos?
    - **Answer (A):** Capture the URLs of all available photos for each artwork, as shown in the example.

11. **Artist Data Uniqueness:** How should the script handle multiple artworks by the same artist?
    - **Answer (A):** Create a single, unique JSON file for each artist, and ensure all their artworks reference this single source of truth.

12. **Dependency Management:** What is the preferred approach for managing external libraries (e.g., for HTTP requests or HTML parsing)?
    - **Answer (B):** Write the script with zero external dependencies, using only built-in Node.js modules.

13. **Logging and Reporting:** What level of logging is required during the script's execution?
    - **Answer (C):** The script should produce verbose, debug-level logs detailing every single action taken.

14. **Configuration:** How should the script be configured?
    - **Answer (B):** Store configuration parameters (like base URL, output paths) in a separate JSON file.

15. **Relationship to Other Collectors:** How does this script relate to other potential data collectors?
    - **Answer (B):** It is the first of many planned collectors, and its architecture should serve as a template.

16. **Handling Website Changes:** What is the expectation if the Burnaby Art Gallery website changes its structure in the future?
    - **Answer (A):** The script is expected to fail. A new development task would be required to update or rewrite it.

17. **Data Transformation:** What is the extent of data transformation required?
    - **Answer (A):** Limited to the specified field renaming ("about" to "description") and structuring the data into the required JSON format.

18. **Execution Environment:** Where is this script intended to be run?
    - **Answer (A):** Manually by a developer on their local machine as a one-off task.

19. **Source URL Integrity:** How important is the `source_url` field?
    - **Answer (A):** It is a critical field that must point to the exact web page where the data for that specific artwork or artist was found.

20. **Non-Goals:** What is explicitly out of scope for this project?
    - **Answer (A & B):** Building a user interface, creating an automated update mechanism, or supporting any gallery other than the Burnaby Art Gallery. Scraping any data beyond the public art registry (e.g., news, events).

## Functional Requirements

21. **Data Storage:** Where should the script store the final output files?
    - **Answer (A):** In a new `output` directory at `src/lib/data-collection/burnabyartgallery/output/`.

22. **File Naming Convention (Artworks):** How should the main GeoJSON file containing all artworks be named?
    - **Answer (A):** `artworks.geojson`

23. **File Naming Convention (Artists):** How should the individual artist JSON files be named?
    - **Answer (D):** All artists should be in a single `artists.json` file.

24. **Coordinate Extraction:** The example shows coordinates `[-122.915511, 49.278845]`. How should the script handle cases where coordinates are not available for an artwork?
    - **Answer (C):** Exclude the artwork from the output file. This should produce a warning in the report at the end.

25. **"About" to "Description" Mapping:** The brief requires renaming the "about" field to "description". What should happen if an artwork has no "about" text?
    - **Answer (A):** The `description` property should be an empty string `""`.

26. **Incremental Scraping:** When the script is re-run, how should it handle existing files in the output directory?
    - **Answer (D):** It should create new files with a version number, e.g., `fafard_joe_v2.json`.

27. **Artist "source_url":** The artist example URL is long and includes faceting parameters. What is the ideal `source_url` for an artist?
    - **Answer (B):** The exact, full URL that was used during scraping, even if it's long.

28. **Handling Pagination:** The artwork list page (`...&p=1&ps=200...`) is paginated. How should the script discover all artworks?
    - **Answer (A):** It should parse the total number of pages/records and iterate through each page to collect all artwork links first, then visit each link.

29. **Rate Limiting/Throttling:** To avoid overwhelming the gallery's server, what delay should be implemented between HTTP requests?
    - **Answer (A):** A configurable delay (e.g., defaulting to 250ms) between each request to a page.

30. **Keyword Parsing:** The `keywords` field is a comma-separated string. How should this be processed?
    - **Answer (A):** Store it as a single string, exactly as it appears on the website.

31. **Date Field:** The `date` field shows "1967". What should the script do if the date is a range (e.g., "1967-1968") or contains text (e.g., "c. 1967")?
    - **Answer (A):** Store the value as a string exactly as it is presented on the website.

32. **Artist Name Normalization:** The example shows "Fafard, Joe". How should artist names be stored?
    - **Answer (A):** Exactly as they appear on the website, including the "Last, First" format.

33. **Script Entry Point:** How should the script be executed?
    - **Answer (A):** As a TypeScript file run via `ts-node`, e.g., `ts-node src/lib/data-collection/burnabyartgallery/index.ts`.

34. **GeoJSON `id` field:** The example `id` is `node/publicart46`. How should this ID be generated?
    - **Answer (A):** By taking the identifier from the artwork's URL (`.../link/publicart46`) and prepending `node/`.

35. **Handling Empty Biographies:** If an artist page has no biography text, what should the `biography` field in the JSON be?
    - **Answer (A):** An empty string `""`.

36. **`artwork_type` field:** The example shows `artwork_type: "sculpture"`. Where does this data come from?
    - **Answer (A):** It should be scraped from the artwork's page. If not found, it should be "unknown".

37. **`source` field:** The brief specifies the `source` as "https://burnabyartgallery.ca". Should this be configurable?
    -   **Answer (A):** No, it should be a hardcoded constant in the script as it's specific to this collector.

38. **Character Encoding:** What should the script assume about the website's character encoding?
    -   **Answer (A):** Assume UTF-8, which is the web standard, and ensure the output files are also saved as UTF-8.

39. **Image URL Cleaning:** The example photo URL has a `?width=1200` parameter. What should be done with such query parameters?
    -   **Answer (A):** The URL should be stored exactly as found, including the query parameter.

40. **Final Summary Report:** What information should be in the final summary report logged to the console?
    -   **Answer (A):** Total artworks found, total artists found, number of files written, and total execution time.
