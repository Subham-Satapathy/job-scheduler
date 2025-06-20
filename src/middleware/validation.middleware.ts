import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger';

// Validation targets
export type ValidationTarget = 'body' | 'params' | 'query';

// Validation error response format
interface ValidationErrorResponse {
  error: string;
  details: Array<{
    field: string;
    message: string;
    code: string;
  }>;
}

// Format zod errors into a user-friendly format
function formatZodErrors(error: ZodError): ValidationErrorResponse['details'] {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code
  }));
}

// Generic validation middleware factory
export function validate(
  schema: ZodSchema,
  target: ValidationTarget = 'body'
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      let dataToValidate;
      
      switch (target) {
        case 'body':
          dataToValidate = req.body;
          break;
        case 'params':
          dataToValidate = req.params;
          break;
        case 'query':
          dataToValidate = req.query;
          break;
        default:
          throw new Error(`Invalid validation target: ${target}`);
      }

      // Validate and transform the data
      const validatedData = schema.parse(dataToValidate);
      
      // Replace the original data with validated/transformed data
      switch (target) {
        case 'body':
          req.body = validatedData;
          break;
        case 'params':
          req.params = validatedData;
          break;
        case 'query':
          req.query = validatedData;
          break;
      }

      logger.debug(`Validation successful for ${target}`, {
        target,
        validatedFields: Object.keys(validatedData || {})
      });

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = formatZodErrors(error);
        
        logger.warn(`Validation failed for ${target}`, {
          target,
          errors: validationErrors,
          originalData: target === 'body' ? req.body : target === 'params' ? req.params : req.query
        });

        return res.status(400).json({
          error: `Invalid ${target} data`,
          details: validationErrors
        } as ValidationErrorResponse);
      }

      // Handle unexpected errors
      logger.error(`Unexpected validation error for ${target}:`, error);
      return res.status(500).json({
        error: 'Internal validation error',
        details: [{
          field: 'unknown',
          message: 'An unexpected error occurred during validation',
          code: 'internal_error'
        }]
      } as ValidationErrorResponse);
    }
  };
}

// Convenience methods for common validation targets
export const validateBody = (schema: ZodSchema) => validate(schema, 'body');
export const validateParams = (schema: ZodSchema) => validate(schema, 'params');
export const validateQuery = (schema: ZodSchema) => validate(schema, 'query');

// Combined validation for multiple targets
export function validateMultiple(validators: {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}) {
  const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];

  if (validators.params) {
    middlewares.push(validateParams(validators.params));
  }
  if (validators.query) {
    middlewares.push(validateQuery(validators.query));
  }
  if (validators.body) {
    middlewares.push(validateBody(validators.body));
  }

  return middlewares;
} 