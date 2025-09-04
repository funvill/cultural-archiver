/**
 * Unit tests for Schema Extraction Tool
 * Cultural Archiver Database Schema Consolidation
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { SchemaExtractor } from './extract-schema';

// Mock the file system and fetch
vi.mock('fs/promises');
vi.mock('dotenv');

// Mock environment variables
const mockEnv = {
    D1_DATABASE_ID: 'test-database-id',
    CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
    CLOUDFLARE_API_TOKEN: 'test-api-token',
};

// Mock fetch globally
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

describe('SchemaExtractor', () => {
    let extractor: SchemaExtractor;

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Set up environment variables
        vi.stubEnv('D1_DATABASE_ID', mockEnv.D1_DATABASE_ID);
        vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', mockEnv.CLOUDFLARE_ACCOUNT_ID);
        vi.stubEnv('CLOUDFLARE_API_TOKEN', mockEnv.CLOUDFLARE_API_TOKEN);
        
        extractor = new SchemaExtractor();
    });

    describe('Constructor and Configuration', () => {
        it('should load configuration from environment variables', () => {
            expect(() => new SchemaExtractor()).not.toThrow();
        });

        it('should throw error when D1_DATABASE_ID is missing', () => {
            vi.stubEnv('D1_DATABASE_ID', '');
            expect(() => new SchemaExtractor()).toThrow('D1_DATABASE_ID environment variable is required');
        });

        it('should throw error when CLOUDFLARE_ACCOUNT_ID is missing', () => {
            vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '');
            expect(() => new SchemaExtractor()).toThrow('CLOUDFLARE_ACCOUNT_ID environment variable is required');
        });

        it('should throw error when CLOUDFLARE_API_TOKEN is missing', () => {
            vi.stubEnv('CLOUDFLARE_API_TOKEN', '');
            expect(() => new SchemaExtractor()).toThrow('CLOUDFLARE_API_TOKEN environment variable is required');
        });
    });

    describe('Database Connection', () => {
        it('should test connection successfully', async () => {
            mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
                success: true,
                result: [{ results: [{ test: 1 }] }]
            })));

            const result = await extractor.testConnection();
            expect(result).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(
                `https://api.cloudflare.com/client/v4/accounts/${mockEnv.CLOUDFLARE_ACCOUNT_ID}/d1/database/${mockEnv.D1_DATABASE_ID}/query`,
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': `Bearer ${mockEnv.CLOUDFLARE_API_TOKEN}`,
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify({ sql: 'SELECT 1 as test' }),
                })
            );
        });

        it('should handle connection failure', async () => {
            mockFetch.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

            const result = await extractor.testConnection();
            expect(result).toBe(false);
        });

        it('should handle network error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const result = await extractor.testConnection();
            expect(result).toBe(false);
        });
    });

    describe('Schema Extraction', () => {
        const mockTablesResponse = {
            success: true,
            result: [{
                results: [
                    { name: 'artwork', sql: 'CREATE TABLE artwork (id TEXT PRIMARY KEY, title TEXT NOT NULL)' },
                    { name: 'logbook', sql: 'CREATE TABLE logbook (id TEXT PRIMARY KEY, artwork_id TEXT)' },
                ]
            }]
        };

        const mockIndexesResponse = {
            success: true,
            result: [{
                results: [
                    { name: 'idx_artwork_title', sql: 'CREATE INDEX idx_artwork_title ON artwork(title)' },
                ]
            }]
        };

        const mockTriggersResponse = {
            success: true,
            result: [{
                results: [
                    { name: 'trigger_artwork_updated', sql: 'CREATE TRIGGER trigger_artwork_updated AFTER UPDATE ON artwork' },
                ]
            }]
        };

        it('should extract schema successfully', async () => {
            mockFetch
                .mockResolvedValueOnce(new Response(JSON.stringify(mockTablesResponse)))
                .mockResolvedValueOnce(new Response(JSON.stringify(mockIndexesResponse)))
                .mockResolvedValueOnce(new Response(JSON.stringify(mockTriggersResponse)));

            const schemaSQL = await extractor.extractSchema();

            expect(schemaSQL).toContain('CREATE TABLE artwork');
            expect(schemaSQL).toContain('CREATE TABLE logbook');
            expect(schemaSQL).toContain('CREATE INDEX idx_artwork_title');
            expect(schemaSQL).toContain('CREATE TRIGGER trigger_artwork_updated');
            expect(schemaSQL).toContain('-- Cultural Archiver Database Schema (Consolidated)');
            expect(schemaSQL).toContain('PRAGMA foreign_keys = ON');
        });

        it('should handle empty database', async () => {
            const emptyResponse = {
                success: true,
                result: [{ results: [] }]
            };

            mockFetch
                .mockResolvedValueOnce(new Response(JSON.stringify(emptyResponse)))
                .mockResolvedValueOnce(new Response(JSON.stringify(emptyResponse)))
                .mockResolvedValueOnce(new Response(JSON.stringify(emptyResponse)));

            await expect(extractor.extractSchema()).rejects.toThrow('Schema validation failed: No CREATE TABLE statements found');
        });

        it('should validate extracted schema', async () => {
            const tablesOnlyResponse = {
                success: true,
                result: [{ results: [{ name: 'test_table', sql: 'CREATE TABLE test_table (id TEXT)' }] }]
            };
            const emptyResponse = {
                success: true,
                result: [{ results: [] }]
            };

            mockFetch
                .mockResolvedValueOnce(new Response(JSON.stringify(tablesOnlyResponse)))
                .mockResolvedValueOnce(new Response(JSON.stringify(emptyResponse)))
                .mockResolvedValueOnce(new Response(JSON.stringify(emptyResponse)));

            await expect(extractor.extractSchema()).resolves.toBeDefined();
        });

        it('should fail validation with no tables', async () => {
            const emptyResponse = {
                success: true,
                result: [{ results: [] }]
            };

            mockFetch
                .mockResolvedValueOnce(new Response(JSON.stringify(emptyResponse)))
                .mockResolvedValueOnce(new Response(JSON.stringify(emptyResponse)))
                .mockResolvedValueOnce(new Response(JSON.stringify(emptyResponse)));

            await expect(extractor.extractSchema()).rejects.toThrow('Schema validation failed: No CREATE TABLE statements found');
        });

        it('should handle API errors', async () => {
            mockFetch.mockResolvedValueOnce(new Response('Server Error', { status: 500 }));

            await expect(extractor.extractSchema()).rejects.toThrow();
        });

        it('should handle Cloudflare API error responses', async () => {
            mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({
                success: false,
                errors: [{ message: 'Invalid database ID' }]
            })));

            await expect(extractor.extractSchema()).rejects.toThrow();
        });
    });

    describe('SQL Generation', () => {
        it('should generate properly formatted SQL', async () => {
            const mockResponse = {
                success: true,
                result: [{
                    results: [
                        { name: 'users', sql: 'CREATE TABLE users (id TEXT PRIMARY KEY)' },
                    ]
                }]
            };
            const emptyResponse = {
                success: true,
                result: [{ results: [] }]
            };

            mockFetch
                .mockResolvedValueOnce(new Response(JSON.stringify(mockResponse)))
                .mockResolvedValueOnce(new Response(JSON.stringify(emptyResponse)))
                .mockResolvedValueOnce(new Response(JSON.stringify(emptyResponse)));

            const schemaSQL = await extractor.extractSchema();

            // Check structure
            expect(schemaSQL).toMatch(/-- Cultural Archiver Database Schema \(Consolidated\)/);
            expect(schemaSQL).toMatch(/-- Extracted on: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
            expect(schemaSQL).toContain('PRAGMA foreign_keys = ON;');
            expect(schemaSQL).toContain('-- Tables');
            expect(schemaSQL).toContain('-- Table: users');
            expect(schemaSQL).toContain('CREATE TABLE users (id TEXT PRIMARY KEY);');
        });

        it('should include all schema sections when data is present', async () => {
            const mockTablesResponse = {
                success: true,
                result: [{
                    results: [
                        { name: 'artwork', sql: 'CREATE TABLE artwork (id TEXT PRIMARY KEY, title TEXT NOT NULL)' },
                        { name: 'logbook', sql: 'CREATE TABLE logbook (id TEXT PRIMARY KEY, artwork_id TEXT)' },
                    ]
                }]
            };

            const mockIndexesResponse = {
                success: true,
                result: [{
                    results: [
                        { name: 'idx_artwork_title', sql: 'CREATE INDEX idx_artwork_title ON artwork(title)' },
                    ]
                }]
            };

            const mockTriggersResponse = {
                success: true,
                result: [{
                    results: [
                        { name: 'trigger_artwork_updated', sql: 'CREATE TRIGGER trigger_artwork_updated AFTER UPDATE ON artwork' },
                    ]
                }]
            };

            mockFetch
                .mockResolvedValueOnce(new Response(JSON.stringify(mockTablesResponse)))
                .mockResolvedValueOnce(new Response(JSON.stringify(mockIndexesResponse)))
                .mockResolvedValueOnce(new Response(JSON.stringify(mockTriggersResponse)));

            const schemaSQL = await extractor.extractSchema();

            expect(schemaSQL).toContain('-- Tables');
            expect(schemaSQL).toContain('-- Indexes');
            expect(schemaSQL).toContain('-- Triggers');
        });
    });

    describe('Error Handling', () => {
        it('should handle network failures gracefully', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

            await expect(extractor.extractSchema()).rejects.toThrow();
        });

        it('should handle malformed JSON responses', async () => {
            mockFetch.mockResolvedValueOnce(new Response('invalid json'));

            await expect(extractor.extractSchema()).rejects.toThrow();
        });
    });

    describe('Help and Usage', () => {
        it('should display help information', () => {
            const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
            
            extractor.showHelp();
            
            expect(consoleSpy).toHaveBeenCalledWith('Cultural Archiver Schema Extraction Tool');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('D1_DATABASE_ID'));
            
            consoleSpy.mockRestore();
        });
    });
});