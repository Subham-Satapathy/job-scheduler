"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const job_controller_1 = require("../controllers/job.controller");
const validation_middleware_1 = require("../middleware/validation.middleware");
const job_validation_1 = require("../validation/job.validation");
const router = (0, express_1.Router)();
/**
 * @swagger
 * tags:
 *   name: Jobs
 *   description: Job management operations
 */
/**
 * @swagger
 * /jobs:
 *   get:
 *     summary: Get all jobs
 *     description: Retrieve a paginated list of all jobs with optional filtering
 *     tags: [Jobs]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of jobs per page
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, running, completed, failed]
 *         description: Filter jobs by status
 *     responses:
 *       200:
 *         description: Successfully retrieved jobs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Job'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 */
router.get('/', (0, validation_middleware_1.validateQuery)(job_validation_1.getAllJobsQuerySchema), job_controller_1.jobController.getAllJobs.bind(job_controller_1.jobController));
/**
 * @swagger
 * /jobs/{id}:
 *   get:
 *     summary: Get job by ID
 *     description: Retrieve a specific job by its ID
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Successfully retrieved job
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Job'
 *       404:
 *         description: Job not found
 */
router.get('/:id', (0, validation_middleware_1.validateParams)(job_validation_1.getJobParamsSchema), job_controller_1.jobController.getJob.bind(job_controller_1.jobController));
/**
 * @swagger
 * /jobs:
 *   post:
 *     summary: Create a new job
 *     description: Create a new job with the specified configuration
 *     tags: [Jobs]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, frequency, startDate, data]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Data Processing Job"
 *               description:
 *                 type: string
 *                 example: "Process daily data from database"
 *               enabled:
 *                 type: boolean
 *                 default: true
 *                 example: true
 *               frequency:
 *                 type: string
 *                 enum: [ONCE, DAILY, WEEKLY, MONTHLY, CUSTOM]
 *                 example: "DAILY"
 *               cronExpression:
 *                 type: string
 *                 example: null
 *               startDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-12-20T09:00:00.000Z"
 *               endDate:
 *                 type: string
 *                 format: date-time
 *                 example: null
 *               data:
 *                 type: object
 *                 example: {"source": "database", "type": "processing"}
 *               maxRetries:
 *                 type: integer
 *                 default: 3
 *                 example: 3
 *     responses:
 *       201:
 *         description: Job created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Job created successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Job'
 *       400:
 *         description: Invalid request data
 */
router.post('/', (0, validation_middleware_1.validateBody)(job_validation_1.createJobSchema), job_controller_1.jobController.createJob.bind(job_controller_1.jobController));
/**
 * @swagger
 * /jobs/{id}:
 *   put:
 *     summary: Update a job
 *     description: Update an existing job's configuration
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Job ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               enabled:
 *                 type: boolean
 *               frequency:
 *                 type: string
 *                 enum: [ONCE, DAILY, WEEKLY, MONTHLY, CUSTOM]
 *               cronExpression:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               data:
 *                 type: object
 *               maxRetries:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Job updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Job'
 *       404:
 *         description: Job not found
 *       400:
 *         description: Invalid request data
 */
router.put('/:id', (0, validation_middleware_1.validateParams)(job_validation_1.getJobParamsSchema), (0, validation_middleware_1.validateBody)(job_validation_1.updateJobSchema), job_controller_1.jobController.updateJob.bind(job_controller_1.jobController));
/**
 * @swagger
 * /jobs/{id}:
 *   delete:
 *     summary: Delete a job
 *     description: Permanently delete a job and remove it from the queue
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Job ID
 *     responses:
 *       204:
 *         description: Job deleted successfully
 *       404:
 *         description: Job not found
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', (0, validation_middleware_1.validateParams)(job_validation_1.getJobParamsSchema), job_controller_1.jobController.deleteJob.bind(job_controller_1.jobController));
/**
 * @swagger
 * /jobs/{id}/enable:
 *   patch:
 *     summary: Enable a job
 *     description: Enables a job and schedules it for execution if it's pending
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job enabled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Job enabled successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Job'
 *       404:
 *         description: Job not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Job not found"
 *       500:
 *         description: Internal server error
 */
router.patch('/:id/enable', (0, validation_middleware_1.validateParams)(job_validation_1.getJobParamsSchema), job_controller_1.jobController.enableJob.bind(job_controller_1.jobController));
/**
 * @swagger
 * /jobs/{id}/disable:
 *   patch:
 *     summary: Disable a job
 *     description: Disables a job and removes it from the execution queue
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Job ID
 *     responses:
 *       200:
 *         description: Job disabled successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Job disabled successfully"
 *                 data:
 *                   $ref: '#/components/schemas/Job'
 *       404:
 *         description: Job not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Job not found"
 *       500:
 *         description: Internal server error
 */
router.patch('/:id/disable', (0, validation_middleware_1.validateParams)(job_validation_1.getJobParamsSchema), job_controller_1.jobController.disableJob.bind(job_controller_1.jobController));
exports.default = router;
