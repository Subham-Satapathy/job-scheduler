export enum JobStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum JobFrequency {
  ONCE = 'ONCE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  CUSTOM = 'CUSTOM',
}

export interface Job {
  id: number;
  name: string;
  description: string | null;
  status: JobStatus;
  enabled: boolean;
  frequency: JobFrequency;
  cronExpression: string | null;
  startDate: Date;
  endDate: Date | null;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  data: Record<string, any>;
  dataHash: string | null; // SHA-256 hash for duplicate detection - temporarily nullable for migration
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateJobInput = Omit<Job, 'id' | 'status' | 'retryCount' | 'createdAt' | 'updatedAt' | 'lastRunAt' | 'nextRunAt' | 'dataHash'>;
export type UpdateJobInput = Partial<CreateJobInput>; 