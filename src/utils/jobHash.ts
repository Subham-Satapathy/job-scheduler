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
 * Generate a deterministic hash for job duplicate detection
 * Uses SHA-256 for cryptographic strength and collision resistance
 */
export function generateJobHash(fields: DuplicateCheckFields): string {
  const normalizedData = normalizeData(fields);
  const serializedData = stringifyDeterministic(normalizedData);
  
  return createHash('sha256')
    .update(serializedData)
    .digest('hex');
}

/**
 * Normalizes job data for consistent hashing
 * Ensures that objects with the same content always produce the same hash
 */
function normalizeData(data: any): any {
  if (data === null || data === undefined) {
    return null;
  }

  if (Array.isArray(data)) {
    return data.map(item => normalizeData(item));
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
        normalized[key] = normalizeData(value);
      }
    });

    return normalized;
  }

  return typeof data === 'string' ? data.trim() : data;
}

/**
 * Deterministic JSON stringify that always produces the same string for equivalent objects
 */
function stringifyDeterministic(obj: any): string {
  if (obj === null || obj === undefined) {
    return 'null';
  }

  if (Array.isArray(obj)) {
    return '[' + obj.map(item => stringifyDeterministic(item)).join(',') + ']';
  }

  if (typeof obj === 'object') {
    const keys = Object.keys(obj).sort();
    const pairs = keys.map(key => `"${key}":${stringifyDeterministic(obj[key])}`);
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