"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateQuery = exports.validateParams = exports.validateBody = void 0;
exports.validate = validate;
exports.validateMultiple = validateMultiple;
const zod_1 = require("zod");
const logger_1 = require("../utils/logger");
// Format zod errors into a user-friendly format
function formatZodErrors(error) {
    return error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
    }));
}
// Generic validation middleware factory
function validate(schema, target = 'body') {
    return (req, res, next) => {
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
            logger_1.logger.debug(`Validation successful for ${target}`, {
                target,
                validatedFields: Object.keys(validatedData || {})
            });
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const validationErrors = formatZodErrors(error);
                logger_1.logger.warn(`Validation failed for ${target}`, {
                    target,
                    errors: validationErrors,
                    originalData: target === 'body' ? req.body : target === 'params' ? req.params : req.query
                });
                return res.status(400).json({
                    error: `Invalid ${target} data`,
                    details: validationErrors
                });
            }
            // Handle unexpected errors
            logger_1.logger.error(`Unexpected validation error for ${target}:`, error);
            return res.status(500).json({
                error: 'Internal validation error',
                details: [{
                        field: 'unknown',
                        message: 'An unexpected error occurred during validation',
                        code: 'internal_error'
                    }]
            });
        }
    };
}
// Convenience methods for common validation targets
const validateBody = (schema) => validate(schema, 'body');
exports.validateBody = validateBody;
const validateParams = (schema) => validate(schema, 'params');
exports.validateParams = validateParams;
const validateQuery = (schema) => validate(schema, 'query');
exports.validateQuery = validateQuery;
// Combined validation for multiple targets
function validateMultiple(validators) {
    const middlewares = [];
    if (validators.params) {
        middlewares.push((0, exports.validateParams)(validators.params));
    }
    if (validators.query) {
        middlewares.push((0, exports.validateQuery)(validators.query));
    }
    if (validators.body) {
        middlewares.push((0, exports.validateBody)(validators.body));
    }
    return middlewares;
}
