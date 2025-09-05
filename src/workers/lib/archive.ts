/**
 * Archive utilities for creating ZIP files using Web Streams API
 * Provides functionality for both backup and data dump ZIP creation
 */

import { ApiError } from './errors';

// Configuration constants
const MAX_ARCHIVE_SIZE = 500 * 1024 * 1024; // 500MB limit for in-memory processing
const MAX_FILES_PER_ARCHIVE = 10000; // Reasonable limit for number of files

/**
 * File structure for archive creation
 */
export interface ArchiveFile {
  path: string; // File path within the archive (e.g., "photos/123.jpg", "data/artwork.json")
  content: ArrayBuffer | string | Uint8Array;
  mimeType?: string;
  lastModified?: Date;
}

/**
 * Archive creation options
 */
export interface ArchiveOptions {
  compression?: boolean; // Whether to use compression (defaults to true)
  maxSize?: number; // Maximum size in bytes (defaults to MAX_ARCHIVE_SIZE)
  maxFiles?: number; // Maximum number of files (defaults to MAX_FILES_PER_ARCHIVE)
}

/**
 * Archive creation result
 */
export interface ArchiveResult {
  archiveBuffer: ArrayBuffer;
  totalFiles: number;
  totalSize: number;
  compressionRatio?: number;
  createdAt: string;
}

/**
 * Simple ZIP file creation using basic ZIP format
 * This implements a minimal ZIP format for Cloudflare Workers compatibility
 */
export class SimpleZipArchive {
  private files: ArchiveFile[] = [];
  private options: Required<ArchiveOptions>;

  constructor(options: ArchiveOptions = {}) {
    this.options = {
      compression: options.compression ?? true,
      maxSize: options.maxSize ?? MAX_ARCHIVE_SIZE,
      maxFiles: options.maxFiles ?? MAX_FILES_PER_ARCHIVE,
    };
  }

  /**
   * Add a single file to the archive
   */
  addFile(
    path: string,
    content: ArrayBuffer | string | Uint8Array,
    options?: { mimeType?: string; lastModified?: Date }
  ): void {
    if (this.files.length >= this.options.maxFiles) {
      throw new ApiError(
        `Cannot add more than ${this.options.maxFiles} files to archive`,
        'ARCHIVE_MAX_FILES_EXCEEDED',
        400
      );
    }

    // Validate path
    if (!path || typeof path !== 'string' || path.trim().length === 0) {
      throw new ApiError('File path cannot be empty', 'INVALID_FILE_PATH', 400);
    }

    // Normalize path (remove leading slashes, convert backslashes)
    const normalizedPath = path.replace(/^\/+/, '').replace(/\\/g, '/');

    // Convert content to ArrayBuffer if needed
    let arrayBuffer: ArrayBuffer;
    if (typeof content === 'string') {
      const encoder = new TextEncoder().encode(content);
      arrayBuffer = encoder.buffer.slice(
        encoder.byteOffset,
        encoder.byteOffset + encoder.byteLength
      ) as ArrayBuffer;
    } else if (content instanceof Uint8Array) {
      arrayBuffer = content.buffer.slice(
        content.byteOffset,
        content.byteOffset + content.byteLength
      ) as ArrayBuffer;
    } else {
      arrayBuffer = content;
    }

    // Check size constraints
    const currentSize = this.files.reduce((sum, file) => {
      const fileContent = file.content;
      if (typeof fileContent === 'string') {
        return sum + new TextEncoder().encode(fileContent).byteLength;
      } else if (fileContent instanceof ArrayBuffer) {
        return sum + fileContent.byteLength;
      } else if (fileContent instanceof Uint8Array) {
        return sum + fileContent.byteLength;
      }
      return sum;
    }, 0);

    if (currentSize + arrayBuffer.byteLength > this.options.maxSize) {
      throw new ApiError(
        `Archive would exceed maximum size of ${this.options.maxSize} bytes`,
        'ARCHIVE_MAX_SIZE_EXCEEDED',
        400
      );
    }

    const fileEntry: ArchiveFile = {
      path: normalizedPath,
      content: arrayBuffer,
      lastModified: options?.lastModified || new Date(),
    };

    if (options?.mimeType) {
      fileEntry.mimeType = options.mimeType;
    }

    this.files.push(fileEntry);
  }

  /**
   * Add multiple files to a folder within the archive
   */
  addFilesToFolder(folderPath: string, files: ArchiveFile[]): void {
    if (!folderPath || typeof folderPath !== 'string') {
      throw new ApiError('Folder path must be a non-empty string', 'INVALID_FOLDER_PATH', 400);
    }

    // Normalize folder path
    const normalizedFolder = folderPath.replace(/^\/+/, '').replace(/\\/g, '/');
    const folderPrefix = normalizedFolder.endsWith('/') ? normalizedFolder : `${normalizedFolder}/`;

    for (const file of files) {
      const fullPath = `${folderPrefix}${file.path}`;
      const options: { mimeType?: string; lastModified?: Date } = {};

      if (file.mimeType) {
        options.mimeType = file.mimeType;
      }

      if (file.lastModified) {
        options.lastModified = file.lastModified;
      }

      this.addFile(fullPath, file.content, options);
    }
  }

  /**
   * Generate the ZIP archive
   * Uses a simplified ZIP format compatible with Cloudflare Workers
   */
  async generateArchive(): Promise<ArchiveResult> {
    if (this.files.length === 0) {
      throw new ApiError('Cannot create empty archive', 'EMPTY_ARCHIVE', 400);
    }

    try {
      const startTime = Date.now();

      // For MVP, we'll create a simple archive format that can be extracted
      // This is a simplified implementation focused on functionality over full ZIP compliance
      const archive = await this.createSimpleZip();

      const endTime = Date.now();
      console.log(`Archive created in ${endTime - startTime}ms with ${this.files.length} files`);

      return {
        archiveBuffer: archive,
        totalFiles: this.files.length,
        totalSize: archive.byteLength,
        createdAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error('Archive generation failed:', error);

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError('Failed to generate archive', 'ARCHIVE_GENERATION_FAILED', 500, {
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
      });
    }
  }

  /**
   * Create a simple ZIP-compatible archive
   * This implementation focuses on basic ZIP structure for compatibility
   */
  private async createSimpleZip(): Promise<ArrayBuffer> {
    // ZIP file format constants
    const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
    const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
    const END_OF_CENTRAL_DIR_SIGNATURE = 0x06054b50;

    const entries: Array<{
      file: ArchiveFile;
      offset: number;
      compressedSize: number;
      uncompressedSize: number;
      crc32: number;
    }> = [];

    // Calculate total size needed
    let totalSize = 0;
    let currentOffset = 0;

    // Process each file and calculate sizes
    for (const file of this.files) {
      const content =
        file.content instanceof ArrayBuffer
          ? file.content
          : typeof file.content === 'string'
            ? new TextEncoder().encode(file.content).buffer
            : file.content.buffer;

      const pathBytes = new TextEncoder().encode(file.path);
      const uncompressedSize = content.byteLength;

      // For MVP, we don't compress (store method)
      const compressedSize = uncompressedSize;

      // Calculate CRC32 (simplified - just use length for MVP)
      const crc32 = this.simpleCrc32(new Uint8Array(content));

      entries.push({
        file,
        offset: currentOffset,
        compressedSize,
        uncompressedSize,
        crc32,
      });

      // Local file header size: 30 bytes + filename length + compressed data
      const localHeaderSize = 30 + pathBytes.length + compressedSize;
      currentOffset += localHeaderSize;
      totalSize += localHeaderSize;
    }

    // Add central directory size
    const centralDirStart = currentOffset;
    let centralDirSize = 0;

    for (const entry of entries) {
      const pathBytes = new TextEncoder().encode(entry.file.path);
      centralDirSize += 46 + pathBytes.length; // Central directory header + filename
    }

    // Add end of central directory record size
    const endOfCentralDirSize = 22;
    totalSize += centralDirSize + endOfCentralDirSize;

    // Create the archive buffer
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);
    let offset = 0;

    // Write local file headers and data
    for (const entry of entries) {
      const pathBytes = new TextEncoder().encode(entry.file.path);
      const content =
        entry.file.content instanceof ArrayBuffer
          ? entry.file.content
          : typeof entry.file.content === 'string'
            ? new TextEncoder().encode(entry.file.content).buffer
            : entry.file.content.buffer;

      // Local file header
      view.setUint32(offset, LOCAL_FILE_HEADER_SIGNATURE, true); // Signature
      offset += 4;
      view.setUint16(offset, 20, true); // Version needed
      offset += 2;
      view.setUint16(offset, 0, true); // General purpose bit flag
      offset += 2;
      view.setUint16(offset, 0, true); // Compression method (0 = stored)
      offset += 2;
      view.setUint16(offset, 0, true); // Last mod time
      offset += 2;
      view.setUint16(offset, 0, true); // Last mod date
      offset += 2;
      view.setUint32(offset, entry.crc32, true); // CRC32
      offset += 4;
      view.setUint32(offset, entry.compressedSize, true); // Compressed size
      offset += 4;
      view.setUint32(offset, entry.uncompressedSize, true); // Uncompressed size
      offset += 4;
      view.setUint16(offset, pathBytes.length, true); // Filename length
      offset += 2;
      view.setUint16(offset, 0, true); // Extra field length
      offset += 2;

      // Filename
      uint8View.set(pathBytes, offset);
      offset += pathBytes.length;

      // File data
      uint8View.set(new Uint8Array(content), offset);
      offset += content.byteLength;
    }

    // Write central directory
    for (const entry of entries) {
      const pathBytes = new TextEncoder().encode(entry.file.path);

      // Central directory header
      view.setUint32(offset, CENTRAL_DIRECTORY_SIGNATURE, true); // Signature
      offset += 4;
      view.setUint16(offset, 20, true); // Version made by
      offset += 2;
      view.setUint16(offset, 20, true); // Version needed
      offset += 2;
      view.setUint16(offset, 0, true); // General purpose bit flag
      offset += 2;
      view.setUint16(offset, 0, true); // Compression method
      offset += 2;
      view.setUint16(offset, 0, true); // Last mod time
      offset += 2;
      view.setUint16(offset, 0, true); // Last mod date
      offset += 2;
      view.setUint32(offset, entry.crc32, true); // CRC32
      offset += 4;
      view.setUint32(offset, entry.compressedSize, true); // Compressed size
      offset += 4;
      view.setUint32(offset, entry.uncompressedSize, true); // Uncompressed size
      offset += 4;
      view.setUint16(offset, pathBytes.length, true); // Filename length
      offset += 2;
      view.setUint16(offset, 0, true); // Extra field length
      offset += 2;
      view.setUint16(offset, 0, true); // Comment length
      offset += 2;
      view.setUint16(offset, 0, true); // Disk number
      offset += 2;
      view.setUint16(offset, 0, true); // Internal file attributes
      offset += 2;
      view.setUint32(offset, 0, true); // External file attributes
      offset += 4;
      view.setUint32(offset, entry.offset, true); // Local header offset
      offset += 4;

      // Filename
      uint8View.set(pathBytes, offset);
      offset += pathBytes.length;
    }

    // End of central directory record
    view.setUint32(offset, END_OF_CENTRAL_DIR_SIGNATURE, true); // Signature
    offset += 4;
    view.setUint16(offset, 0, true); // Disk number
    offset += 2;
    view.setUint16(offset, 0, true); // Central directory start disk
    offset += 2;
    view.setUint16(offset, entries.length, true); // Number of central directory records on this disk
    offset += 2;
    view.setUint16(offset, entries.length, true); // Total number of central directory records
    offset += 2;
    view.setUint32(offset, centralDirSize, true); // Central directory size
    offset += 4;
    view.setUint32(offset, centralDirStart, true); // Central directory offset
    offset += 4;
    view.setUint16(offset, 0, true); // Comment length
    offset += 2;

    return buffer;
  }

  /**
   * Simple CRC32 calculation for MVP
   * In production, this should use a proper CRC32 implementation
   */
  private simpleCrc32(data: Uint8Array): number {
    // Simplified CRC32 - just use a hash based on data for MVP
    let crc = 0;
    for (let i = 0; i < data.length; i++) {
      const byte = data[i];
      if (byte !== undefined) {
        crc = ((crc << 1) ^ byte) & 0xffffffff;
      }
    }
    return crc >>> 0; // Ensure unsigned 32-bit integer
  }
}

/**
 * Utility function to create a ZIP archive from files
 */
export async function createZipArchive(
  files: ArchiveFile[],
  options?: ArchiveOptions
): Promise<ArchiveResult> {
  if (!files || !Array.isArray(files)) {
    throw new ApiError('Files must be provided as an array', 'INVALID_FILES_ARRAY', 400);
  }

  if (files.length === 0) {
    throw new ApiError('Cannot create archive with no files', 'EMPTY_FILES_ARRAY', 400);
  }

  const archive = new SimpleZipArchive(options);

  // Add all files to the archive
  for (const file of files) {
    if (!file.path || !file.content) {
      throw new ApiError('Each file must have a path and content', 'INVALID_FILE_STRUCTURE', 400);
    }

    const options: { mimeType?: string; lastModified?: Date } = {};

    if (file.mimeType) {
      options.mimeType = file.mimeType;
    }

    if (file.lastModified) {
      options.lastModified = file.lastModified;
    }

    archive.addFile(file.path, file.content, options);
  }

  return await archive.generateArchive();
}

/**
 * Utility function to add a single file to an archive
 */
export function addFileToArchive(
  archive: SimpleZipArchive,
  path: string,
  content: ArrayBuffer | string
): void {
  if (!archive || !(archive instanceof SimpleZipArchive)) {
    throw new ApiError('Invalid archive instance provided', 'INVALID_ARCHIVE', 400);
  }

  archive.addFile(path, content);
}

/**
 * Utility function to add files to a folder within an archive
 */
export function addFolderToArchive(
  archive: SimpleZipArchive,
  folderPath: string,
  files: ArchiveFile[]
): void {
  if (!archive || !(archive instanceof SimpleZipArchive)) {
    throw new ApiError('Invalid archive instance provided', 'INVALID_ARCHIVE', 400);
  }

  archive.addFilesToFolder(folderPath, files);
}

/**
 * Format bytes for human-readable display
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}
