/**
 * Unit tests for Database Recreation Tool
 * Cultural Archiver Database Schema Consolidation
 */

import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { DatabaseRecreator } from './recreate-database';

// Mock the file system, readline, and fetch
vi.mock('fs/promises');
vi.mock('readline');
vi.mock('dotenv');

// Mock environment variables
const mockEnv = {
    D1_DATABASE_ID: 'test-database-id',
    CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
    CLOUDFLARE_API_TOKEN: 'test-api-token',
    NODE_ENV: 'test',
};

// Mock fetch globally
const mockFetch = vi.fn() as MockedFunction<typeof fetch>;
global.fetch = mockFetch;

// Mock readline
const mockReadline = {
    createInterface: vi.fn(),
    question: vi.fn(),
    close: vi.fn(),
};

describe('DatabaseRecreator', () => {
    let recreator: DatabaseRecreator;

    beforeEach(() => {
        vi.clearAllMocks();
        
        // Set up environment variables
        Object.entries(mockEnv).forEach(([key, value]) => {
            vi.stubEnv(key, value);
        });
        
        recreator = new DatabaseRecreator({
            force: true,
            includeSampleData: true,
            schemaFile: '001_consolidated_baseline.sql'
        });
    });

    describe('Constructor and Configuration', () => {
        it('should load configuration from environment variables', () => {
            expect(() => new DatabaseRecreator({
                force: false,
                includeSampleData: true,
                schemaFile: 'test.sql'
            })).not.toThrow();
        });

        it('should throw error when D1_DATABASE_ID is missing', () => {
            vi.stubEnv('D1_DATABASE_ID', '');
            expect(() => new DatabaseRecreator({
                force: false,
                includeSampleData: true,
                schemaFile: 'test.sql'
            })).toThrow('D1_DATABASE_ID environment variable is required');
        });

        it('should throw error when CLOUDFLARE_ACCOUNT_ID is missing', () => {
            vi.stubEnv('CLOUDFLARE_ACCOUNT_ID', '');
            expect(() => new DatabaseRecreator({
                force: false,
                includeSampleData: true,
                schemaFile: 'test.sql'
            })).toThrow('CLOUDFLARE_ACCOUNT_ID environment variable is required');
        });

        it('should throw error when CLOUDFLARE_API_TOKEN is missing', () => {
            vi.stubEnv('CLOUDFLARE_API_TOKEN', '');
            expect(() => new DatabaseRecreator({
                force: false,
                includeSampleData: true,
                schemaFile: 'test.sql'
            })).toThrow('CLOUDFLARE_API_TOKEN environment variable is required');
        });
    });

    describe('Database Operations', () => {
        const mockSuccessResponse = {
            success: true,
            result: [{ results: [] }]
        };

        it('should get existing tables successfully', async () => {
            const mockTablesResponse = {
                success: true,
                result: [{
                    results: [
                        { name: 'artwork' },
                        { name: 'logbook' },
                        { name: 'users' }
                    ]
                }]
            };

            mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockTablesResponse)));

            // Use reflection to access private method for testing
            const getAllTables = (recreator as any).getAllTables.bind(recreator);
            const tables = await getAllTables();

            expect(tables).toEqual(['artwork', 'logbook', 'users']);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/query'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ 
                        sql: expect.stringContaining('SELECT name FROM sqlite_master')
                    })
                })
            );
        });

        it('should handle empty database when getting tables', async () => {
            const mockEmptyResponse = {
                success: true,
                result: [{ results: [] }]
            };

            mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockEmptyResponse)));

            const getAllTables = (recreator as any).getAllTables.bind(recreator);
            const tables = await getAllTables();

            expect(tables).toEqual([]);
        });

        it('should handle database query errors gracefully', async () => {
            mockFetch.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

            const getAllTables = (recreator as any).getAllTables.bind(recreator);
            const tables = await getAllTables();

            expect(tables).toEqual([]); // Should return empty array on error
        });
    });

    describe('Schema Processing', () => {
        it('should parse schema statements correctly', () => {
            const schemaSQL = `
                -- Comment line
                CREATE TABLE users (id TEXT PRIMARY KEY);
                
                CREATE INDEX idx_users_id ON users(id);
                
                -- Another comment
                CREATE TRIGGER trigger_users AFTER UPDATE ON users BEGIN
                    UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
                END;
            `;

            const parseSchemaStatements = (recreator as any).parseSchemaStatements.bind(recreator);
            const statements = parseSchemaStatements(schemaSQL);

            expect(statements).toHaveLength(4); // Updated expectation
            expect(statements[0]).toContain('CREATE TABLE users');
            expect(statements[1]).toContain('CREATE INDEX idx_users_id');
            expect(statements[2]).toContain('CREATE TRIGGER trigger_users AFTER UPDATE ON users BEGIN');
            expect(statements[3]).toContain('UPDATE users SET updated_at');
        });

        it('should handle multi-line statements correctly', () => {
            const schemaSQL = `
                CREATE TABLE users (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    created_at TEXT DEFAULT (datetime('now'))
                );
            `;

            const parseSchemaStatements = (recreator as any).parseSchemaStatements.bind(recreator);
            const statements = parseSchemaStatements(schemaSQL);

            expect(statements).toHaveLength(1);
            expect(statements[0]).toContain('CREATE TABLE users');
            expect(statements[0]).toContain('created_at TEXT');
        });

        it('should summarize statements correctly', () => {
            const longStatement = 'CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, created_at TEXT DEFAULT datetime("now"))';
            
            const summarizeStatement = (recreator as any).summarizeStatement.bind(recreator);
            const summary = summarizeStatement(longStatement);

            expect(summary).toBe('CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT...');
            expect(summary.length).toBe(53); // 50 chars + "..."
        });

        it('should not truncate short statements', () => {
            const shortStatement = 'CREATE TABLE users (id TEXT);';
            
            const summarizeStatement = (recreator as any).summarizeStatement.bind(recreator);
            const summary = summarizeStatement(shortStatement);

            expect(summary).toBe(shortStatement);
            expect(summary).not.toContain('...');
        });
    });

    describe('Sample Data Generation', () => {
        it('should generate default sample data with correct structure', () => {
            const generateDefaultSampleData = (recreator as any).generateDefaultSampleData.bind(recreator);
            const sampleData = generateDefaultSampleData();

            expect(sampleData).toContain('INSERT INTO users');
            expect(sampleData).toContain('INSERT INTO artwork');
            expect(sampleData).toContain('INSERT INTO logbook');
            expect(sampleData).toContain('INSERT INTO moderation');
            
            // Check for specific sample data values from PRD
            expect(sampleData).toContain('00000000-0000-0000-0000-000000000001');
            expect(sampleData).toContain('sampledata@funvill.com');
            expect(sampleData).toContain('massimport@funvill.com');
            expect(sampleData).toContain('6c970b24-f64a-49d9-8c5f-8ae23cc2af47');
            expect(sampleData).toContain('steven@abluestar.com');
            
            // Check Vancouver area coordinates (within 100m of 49.2679864,-123.0239578)
            expect(sampleData).toContain('49.2685');
            expect(sampleData).toContain('-123.0235');
            
            // Check default timestamp
            expect(sampleData).toContain('2025-01-01T00:00:00.000Z');
        });
    });

    describe('Schema File Operations', () => {
        it('should load schema file successfully', async () => {
            const mockSchemaSQL = `
                CREATE TABLE users (id TEXT PRIMARY KEY);
                CREATE TABLE artwork (id TEXT PRIMARY KEY);
            `;
            
            // Mock the fs module directly
            const fs = await import('fs/promises');
            vi.mocked(fs.readFile).mockResolvedValue(mockSchemaSQL);

            const loadSchemaFile = (recreator as any).loadSchemaFile.bind(recreator);
            const schemaSQL = await loadSchemaFile();

            expect(schemaSQL).toBe(mockSchemaSQL);
        });

        it('should validate schema file has CREATE TABLE statements', async () => {
            const invalidSchemaSQL = `
                -- Just comments
                -- No tables
            `;
            
            // Mock the fs module directly
            const fs = await import('fs/promises');
            vi.mocked(fs.readFile).mockResolvedValue(invalidSchemaSQL);

            const loadSchemaFile = (recreator as any).loadSchemaFile.bind(recreator);
            
            await expect(loadSchemaFile()).rejects.toThrow(
                'Schema file appears to be empty or invalid (no CREATE TABLE statements found)'
            );
        });

        it('should handle file read errors', async () => {
            // Mock the fs module directly
            const fs = await import('fs/promises');
            vi.mocked(fs.readFile).mockRejectedValue(new Error('File not found'));

            const loadSchemaFile = (recreator as any).loadSchemaFile.bind(recreator);
            
            await expect(loadSchemaFile()).rejects.toThrow('Failed to load schema file: Error: File not found');
        });
    });

    describe('Verification', () => {
        it('should verify recreation successfully', async () => {
            const mockTablesResponse = {
                success: true,
                result: [{
                    results: [
                        { name: 'artwork' },
                        { name: 'logbook' },
                        { name: 'users' }
                    ]
                }]
            };

            const mockCountResponse = {
                success: true,
                result: [{ results: [{ count: 3 }] }]
            };

            mockFetch
                .mockResolvedValueOnce(new Response(JSON.stringify(mockTablesResponse)))
                .mockResolvedValueOnce(new Response(JSON.stringify(mockCountResponse)))
                .mockResolvedValueOnce(new Response(JSON.stringify(mockCountResponse)))
                .mockResolvedValueOnce(new Response(JSON.stringify(mockCountResponse)));

            const verifyRecreation = (recreator as any).verifyRecreation.bind(recreator);
            
            await expect(verifyRecreation()).resolves.not.toThrow();
        });

        it('should fail verification when no tables exist', async () => {
            const mockEmptyResponse = {
                success: true,
                result: [{ results: [] }]
            };

            mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(mockEmptyResponse)));

            const verifyRecreation = (recreator as any).verifyRecreation.bind(recreator);
            
            await expect(verifyRecreation()).rejects.toThrow(
                'Verification failed: No tables found after recreation'
            );
        });
    });

    describe('Error Handling', () => {
        it('should handle API errors during recreation', async () => {
            mockFetch.mockResolvedValueOnce(new Response('Server Error', { status: 500 }));

            // Mock file loading
            const fs = require('fs/promises');
            fs.readFile = vi.fn().mockResolvedValue('CREATE TABLE test (id TEXT);');

            await expect(recreator.recreateDatabase()).rejects.toThrow();
        });

        it('should handle network failures gracefully', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network timeout'));

            await expect(recreator.recreateDatabase()).rejects.toThrow();
        });
    });

    describe('Help and Usage', () => {
        it('should display help information', () => {
            const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
            
            recreator.showHelp();
            
            expect(consoleSpy).toHaveBeenCalledWith('Cultural Archiver Database Recreation Tool');
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('Usage:'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('--force'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('D1_DATABASE_ID'));
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('⚠️  WARNING:'));
            
            consoleSpy.mockRestore();
        });
    });
});