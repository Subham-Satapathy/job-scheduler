import db from '../db';
import { jobs } from '../db/schema';
import { JobFrequency, JobStatus } from '../types/job';
import { eq } from 'drizzle-orm';
import { addDays } from 'date-fns';
import { generateJobHash } from '../utils/jobHash';

// Helper functions to convert enums to database string values
function convertStatusToDbString(status: JobStatus): 'pending' | 'running' | 'completed' | 'failed' {
  switch (status) {
    case JobStatus.PENDING:
      return 'pending';
    case JobStatus.RUNNING:
      return 'running';
    case JobStatus.COMPLETED:
      return 'completed';
    case JobStatus.FAILED:
      return 'failed';
    case JobStatus.CANCELLED:
      return 'failed'; // Map cancelled to failed for database
    default:
      return 'pending';
  }
}

function frequencyToDbString(frequency: JobFrequency): 'once' | 'daily' | 'weekly' | 'monthly' | 'custom' {
  switch (frequency) {
    case JobFrequency.ONCE:
      return 'once';
    case JobFrequency.DAILY:
      return 'daily';
    case JobFrequency.WEEKLY:
      return 'weekly';
    case JobFrequency.MONTHLY:
      return 'monthly';
    case JobFrequency.CUSTOM:
      return 'custom';
    default:
      return 'once';
  }
}

const now = new Date();

const dummyJobs = Array.from({ length: 30 }).map((_, i) => {
  const freq = i % 3 === 0 ? JobFrequency.DAILY : i % 3 === 1 ? JobFrequency.WEEKLY : JobFrequency.MONTHLY;

  const cronMap = {
    [JobFrequency.DAILY]: '0 8 * * *',          // Every day at 8am
    [JobFrequency.WEEKLY]: '0 9 * * MON',       // Every Monday at 9am
    [JobFrequency.MONTHLY]: '0 10 1 * *',       // First of month at 10am
  };

  const jobData = {
    name: `Dummy Job ${i + 1}`,
    description: `This is a dummy job to simulate ${freq} tasks`,
    status: convertStatusToDbString(JobStatus.PENDING),
    frequency: frequencyToDbString(freq),
    cronExpression: cronMap[freq],
    startDate: now,
    endDate: addDays(now, 90),
    lastRunAt: null,
    nextRunAt: addDays(now, i % 5),
    data: {
      email: `user${i + 1}@example.com`,
      type: i % 2 === 0 ? 'notification' : 'reporting',
      payload: {
        userId: i + 1,
        priority: ['low', 'medium', 'high'][i % 3],
      },
    },
    retryCount: 0,
    maxRetries: 3,
    createdAt: now,
    updatedAt: now,
  };

  // Generate dataHash for the job
  const dataHash = generateJobHash({
    name: jobData.name,
    frequency: freq, // Use the original enum for hash generation
    cronExpression: jobData.cronExpression,
    data: jobData.data
  });

  return {
    ...jobData,
    dataHash
  };
});

async function seedJobs() {
  console.log('Seeding jobs...');
  const existing = await db.select().from(jobs).where(eq(jobs.name, 'Dummy Job 1'));
  if (existing.length > 0) {
    console.log('Dummy jobs already exist. Skipping seeding.');
    return;
  }

  await db.insert(jobs).values(dummyJobs);
  console.log('Seeded 30 dummy jobs into the database.');
}

if (require.main === module) {
  seedJobs()
    .then(() => {
      console.log('Seeding completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Seeding failed:', error);
      process.exit(1);
    });
}

export { seedJobs }; 