import swaggerJSDoc from 'swagger-jsdoc';
import { envConfig } from './env.config';

// Swagger OpenAPI definition
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Job Scheduler API',
    version: '1.0.0',
    description: 'A scalable job scheduler microservice API',
  },
  servers: [
    {
      url: `http://localhost:${envConfig.PORT}`,
      description: 'Development server',
    },
  ],
  components: {
    schemas: {
      Job: {
        type: 'object',
        required: ['name', 'frequency', 'startDate', 'data'],
        properties: {
          id: {
            type: 'string',
            description: 'Job ID',
          },
          name: {
            type: 'string',
            description: 'Job name',
          },
          description: {
            type: 'string',
            description: 'Job description',
          },
          status: {
            type: 'string',
            enum: ['pending', 'running', 'completed', 'failed'],
            description: 'Job status',
          },
          enabled: {
            type: 'boolean',
            default: true,
            description: 'Whether the job is enabled for execution',
          },
          frequency: {
            type: 'string',
            enum: ['once', 'daily', 'weekly', 'monthly', 'custom'],
            description: 'Job frequency',
          },
          cronExpression: {
            type: 'string',
            description: 'Cron expression for custom frequency',
          },
          startDate: {
            type: 'string',
            format: 'date-time',
            description: 'Job start date',
          },
          endDate: {
            type: 'string',
            format: 'date-time',
            description: 'Job end date',
          },
          lastRunAt: {
            type: 'string',
            format: 'date-time',
            description: 'Last execution time',
          },
          nextRunAt: {
            type: 'string',
            format: 'date-time',
            description: 'Next scheduled execution time',
          },
          data: {
            type: 'object',
            description: 'Job-specific data',
          },
          retryCount: {
            type: 'integer',
            description: 'Number of retry attempts',
          },
          maxRetries: {
            type: 'integer',
            description: 'Maximum number of retry attempts',
          },
        },
      },
    },
  },
};

// Swagger JSDoc options
const swaggerOptions = {
  definition: swaggerDefinition,
  apis: [
    './src/routes/*.ts', // Development path
    './dist/routes/*.js', // Production path  
    __dirname + '/../routes/*.ts', // Alternative path
    __dirname + '/../routes/*.js'  // Compiled path
  ],
};

// Generate Swagger specification
export const swaggerSpec = swaggerJSDoc(swaggerOptions);

// Export individual pieces if needed
export { swaggerDefinition, swaggerOptions }; 