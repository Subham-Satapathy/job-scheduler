import { createHash } from 'crypto';
import { JobFrequency } from '../types/job';

/**
 * Interface defining the fields used for duplicate detection
 */
export interface DuplicateCheckFields {
  name: string;
  frequency: JobFrequency;
  cronExpression: string | null;
  data: Record<string, any>;
}

/**
 * Generates a deterministic SHA-256 hash for job duplicate detection
 * Creates a unique fingerprint based on job name, frequency, cron expression, and data
 * Uses normalized data serialization to ensure consistent hashing regardless of object property order
 * @param fields - Job fields used for duplicate detection (name, frequency, cronExpression, data)
 * @returns 64-character hexadecimal SHA-256 hash string
 * @example
 * const hash = generateJobHash({
 *   name: "Daily Report",
 *   frequency: JobFrequency.DAILY,
 *   cronExpression: "0 9 * * *",
 *   data: { email: "user@example.com" }
 * });
 */
export function generateJobHash(fields: DuplicateCheckFields): string {
  const normalizedData = normalizeJobHashData(fields);
  const serializedData = stringifyDeterministicForHash(normalizedData);
  
  return createHash('sha256')
    .update(serializedData)
    .digest('hex');
}

/**
 * Normalizes job data specifically for hash generation consistency
 * Ensures that objects with the same content always produce the same hash value
 * Recursively processes nested objects and arrays, sorts object keys, and trims strings
 * @param data - Any data structure to normalize (object, array, primitive)
 * @returns Normalized data structure with consistent ordering and formatting
 */
function normalizeJobHashData(data: any): any {
  if (data === null || data === undefined) {
    return null;
  }

  if (Array.isArray(data)) {
    return data.map(item => normalizeJobHashData(item));
  }

  if (typeof data === 'object' && data !== null) {
    const normalized: Record<string, any> = {};
    
    Object.keys(data).sort().forEach(key => {
      const value = data[key];
      
      if (value === null || value === undefined) {
        normalized[key] = null;
      } else if (typeof value === 'string') {
        normalized[key] = value.trim();
      } else {
        normalized[key] = normalizeJobHashData(value);
      }
    });

    return normalized;
  }

  return typeof data === 'string' ? data.trim() : data;
}

/**
 * Deterministic JSON stringify specifically designed for hash generation
 * Always produces the same string output for equivalent objects regardless of property order
 * Recursively processes objects, arrays, and primitives with consistent formatting
 * @param obj - Any data structure to stringify (object, array, primitive, null/undefined)
 * @returns Deterministic string representation suitable for hash input
 */
function stringifyDeterministicForHash(obj: any): string {
  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(item => stringifyDeterministicForHash(item)).join(',') + ']';
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    const pairs = keys.map(key => `"${key}":${stringifyDeterministicForHash(obj[key])}`);
    return '{' + pairs.join(',') + '}';
  }

  if (typeof obj === 'string') {
    return JSON.stringify(obj);
  }

  return String(obj);
}

/**
 * Validates if two job hash fields would produce the same hash
 * Useful for testing and validation purposes
 */
export function areJobsEquivalent(fields1: DuplicateCheckFields, fields2: DuplicateCheckFields): boolean {
  return generateJobHash(fields1) === generateJobHash(fields2);
} 