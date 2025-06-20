"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
exports.setupTestDatabase = setupTestDatabase;
exports.cleanupTestDatabase = cleanupTestDatabase;
const postgres_js_1 = require("drizzle-orm/postgres-js");
const postgres_1 = __importDefault(require("postgres"));
const migrator_1 = require("drizzle-orm/postgres-js/migrator");
const schema = __importStar(require("../db/schema"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// Use a separate test database URL, fallback to main database if not set
const testDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;
const connection = (0, postgres_1.default)(testDatabaseUrl, {
    max: 1, // Single connection for tests
    prepare: false,
});
exports.db = (0, postgres_js_1.drizzle)(connection, { schema });
async function setupTestDatabase() {
    // Run migrations
    await (0, migrator_1.migrate)(exports.db, { migrationsFolder: './drizzle' });
}
async function cleanupTestDatabase() {
    // Clean up test data
    await exports.db.delete(schema.jobs);
}
// Increase test timeout for slower operations
jest.setTimeout(30000);
// Silence console logs during tests
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};
