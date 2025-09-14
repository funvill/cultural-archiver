# Mass Import Plugin System - Testing Framework

## Overview

Comprehensive testing framework for the modular mass import plugin system, providing utilities for testing plugin interfaces, data pipeline functionality, and CLI integration.

## Test Structure

### Core Test Files

- **`test-utils.ts`** - Mock plugins, test data generators, and validation utilities
- **`plugin-registry.test.ts`** - Plugin discovery and registration tests
- **`data-pipeline.test.ts`** - Data processing pipeline tests
- **`integration.test.ts`** - End-to-end integration tests

### Test Utilities

#### Mock Plugins

```typescript
import { testEnvironment } from './test-utils.js';

// Create mock importer with test data
const mockImporter = testEnvironment.createMockImporter('TestImporter', {
  mockData: generateTestRawData(5),
  shouldFailValidation: false,
  shouldThrowError: false
});

// Create mock exporter
const mockExporter = testEnvironment.createMockExporter('TestExporter', {
  outputType: 'file',
  requiresNetwork: false
});
```

#### Test Data Generation

```typescript
import { generateTestRawData, generateTestImporterConfig, generateTestExporterConfig } from './test-utils.js';

// Generate test artwork data
const testData = generateTestRawData(10); // Creates 10 test records

// Generate configuration objects
const importerConfig = generateTestImporterConfig();
const exporterConfig = generateTestExporterConfig();
```

#### Validation Assertions

```typescript
import { assertValidRawImportData, assertValidationResult, assertPluginInterface } from './test-utils.js';

// Validate data structure
assertValidRawImportData(rawData);

// Validate plugin interface compliance
assertPluginInterface(plugin);

// Validate validation result structure
assertValidationResult(validationResult);
```

## Running Tests

### Command Line

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run with UI
npm run test:ui
```

### Test Configuration

Tests are configured via `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/test/**/*.test.ts'],
    testTimeout: 10000
  }
});
```

## Test Categories

### 1. Plugin Interface Tests

Verify that plugins implement required interfaces:

- **Method existence**: All required methods present
- **Type compliance**: Correct parameter and return types
- **Metadata validation**: Required plugin metadata fields

```typescript
test('should comply with plugin interface', () => {
  const plugin = testEnvironment.createMockImporter('TestPlugin');
  expect(() => assertPluginInterface(plugin)).not.toThrow();
});
```

### 2. Data Processing Tests

Test data flow through the system:

- **Data mapping**: Importer data transformation
- **Validation**: Data validation rules
- **Export processing**: Exporter data handling

```typescript
test('should process data correctly', async () => {
  const testData = generateTestRawData(5);
  const importer = testEnvironment.createMockImporter('Test', { mockData: testData });
  
  const result = await importer.mapData({}, {});
  expect(result).toHaveLength(5);
});
```

### 3. Error Handling Tests

Verify graceful error handling:

- **Plugin errors**: Import/export failures
- **Validation failures**: Invalid data handling
- **Configuration errors**: Bad configuration handling

```typescript
test('should handle errors gracefully', async () => {
  const errorPlugin = testEnvironment.createMockImporter('Error', {
    shouldThrowError: true
  });
  
  await expect(errorPlugin.mapData({}, {})).rejects.toThrow();
});
```

### 4. Integration Tests

End-to-end workflow testing:

- **Complete pipelines**: Importer → Exporter workflows
- **Configuration passing**: Config propagation through system
- **Data integrity**: Data preservation through pipeline

```typescript
test('should maintain data integrity', async () => {
  const originalData = generateTestRawData(3);
  const importer = testEnvironment.createMockImporter('Test', { mockData: originalData });
  const exporter = testEnvironment.createMockExporter('Test');
  
  const imported = await importer.mapData({}, {});
  await exporter.export(imported, {});
  
  const exported = exporter.getExportedData();
  expect(exported).toEqual(originalData);
});
```

## Mock Plugin Features

### MockImporterPlugin

- **Configurable data**: Custom test datasets
- **Error simulation**: Controllable error conditions
- **Validation control**: Success/failure validation modes
- **Interface compliance**: Full ImporterPlugin implementation

### MockExporterPlugin

- **Data capture**: Tracks exported data for verification
- **Configuration tracking**: Records configuration calls
- **Error simulation**: Controllable export failures
- **Result generation**: Provides realistic ExportResult objects

## Best Practices

### 1. Test Isolation

```typescript
beforeEach(() => {
  testEnvironment.clearAll(); // Clean state for each test
});
```

### 2. Realistic Data

```typescript
// Use generated data that matches real-world patterns
const testData = generateTestRawData(10);
testData.forEach(data => {
  expect(data.lat).toBeGreaterThan(-90);
  expect(data.lat).toBeLessThan(90);
});
```

### 3. Error Coverage

```typescript
// Test both success and failure paths
test('success case', async () => { /* ... */ });
test('error case', async () => { /* ... */ });
```

### 4. Configuration Testing

```typescript
test('should handle configuration', async () => {
  const config = { outputPath: '/custom/path' };
  await exporter.configure(config);
  
  const actualConfig = exporter.getExportConfig();
  expect(actualConfig.outputPath).toBe('/custom/path');
});
```

## Debugging Tests

### Console Output

```typescript
// Enable verbose logging for debugging
const mockExporter = testEnvironment.createMockExporter('Debug', {
  verbose: true
});
```

### Data Inspection

```typescript
// Inspect data at various pipeline stages
const result = await pipeline.process(data, options);
console.log('Pipeline result:', result);

const exported = mockExporter.getExportedData();
console.log('Exported data:', exported);
```

## Coverage Goals

- **Plugin Interfaces**: 100% method coverage
- **Error Paths**: All error conditions tested
- **Data Validation**: All validation rules covered
- **Configuration**: All config options tested

## Contributing

When adding new features:

1. **Add corresponding tests** for new functionality
2. **Update mock plugins** if interfaces change
3. **Add integration tests** for new workflows
4. **Document test patterns** for complex features