/**
 * Cocohub API — OpenAPI 3.0 Specification
 *
 * This file assembles the complete OpenAPI spec from modular path and schema
 * definitions. It is the single source of truth for the API contract.
 *
 * Usage:
 *   import { openApiSpec } from './spec';
 *   // Pass to swagger-ui-express or write to openapi.json
 */

import { appointmentPaths } from './paths/appointments';
import { authPaths } from './paths/auth';
import { blockchainPaths } from './paths/blockchain';
import { medicalRecordPaths } from './paths/medicalRecords';
import { medicationPaths } from './paths/medications';
import { petPaths } from './paths/pets';
import { predictionPaths } from './paths/predictions';
import { userPaths } from './paths/users';
import { appointmentSchemas } from '../schemas/appointment';
import { authSchemas } from '../schemas/auth';
import { blockchainSchemas } from '../schemas/blockchain';
import { commonSchemas } from '../schemas/common';
import { medicalRecordSchemas } from '../schemas/medicalRecord';
import { medicationSchemas } from '../schemas/medication';
import { petSchemas } from '../schemas/pet';
import { predictionSchemas } from '../schemas/prediction';
import { userSchemas } from '../schemas/user';

export const openApiSpec = {
  openapi: '3.0.3',

  // ─── Info ──────────────────────────────────────────────────────────────────

  info: {
    title: 'Cocohub API',
    version: '1.0.0',
    description: `
## Overview

The Cocohub API powers the Cocohub mobile app — a blockchain-backed pet health management platform.

### Key capabilities
- **Pet management** — register pets, upload photos, look up by QR code
- **Medical records** — create and retrieve vet visit records with rich structured data
- **Blockchain verification** — anchor medical record hashes on the Stellar network for tamper-proof integrity
- **Appointments** — book, reschedule, and cancel vet appointments
- **Medications** — track medication schedules and dosing history
- **Offline sync** — queue-based sync with conflict resolution for offline-first mobile use

### Authentication

All protected endpoints require a JWT access token in the \`Authorization\` header:

\`\`\`
Authorization: Bearer <token>
\`\`\`

Tokens are obtained via \`POST /auth/login\` or \`POST /auth/register\`.
When a token expires, the client automatically calls \`POST /auth/refresh\` with the stored refresh token.

### Rate limiting

- Login/register endpoints: 10 requests per minute per IP
- All other endpoints: 100 requests per minute per user

### Error format

All errors follow a consistent shape:
\`\`\`json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": { "field": "email", "issue": "Invalid format" }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
\`\`\`
    `.trim(),
    contact: {
      name: 'Cocohub Engineering',
      email: 'engineering@cocohub.app',
      url: 'https://cocohub.app',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },

  // ─── Servers ───────────────────────────────────────────────────────────────

  servers: [
    {
      url: 'http://localhost:3000/api',
      description: 'Local development server',
    },
    {
      url: 'https://staging.cocohub.app/api',
      description: 'Staging environment',
    },
    {
      url: 'https://api.cocohub.app/api',
      description: 'Production environment',
    },
  ],

  // ─── Tags ──────────────────────────────────────────────────────────────────

  tags: [
    {
      name: 'Authentication',
      description: 'Login, register, token refresh, OAuth, and password management',
    },
    {
      name: 'Users',
      description: 'User profile management and role-based access',
    },
    {
      name: 'Pets',
      description: 'Pet registration, profile management, and QR code lookup',
    },
    {
      name: 'Medical Records',
      description: 'Vet visit records with blockchain-backed integrity verification',
    },
    {
      name: 'Appointments',
      description: 'Vet appointment scheduling and management',
    },
    {
      name: 'Medications',
      description: 'Medication schedules and dosing tracking',
    },
    {
      name: 'Blockchain',
      description: 'Stellar blockchain integration for tamper-proof medical record anchoring',
    },
    {
      name: 'Predictions',
      description: 'AI-assisted veterinary triage and symptom analysis',
    },
  ],

  // ─── Paths ─────────────────────────────────────────────────────────────────

  paths: {
    ...authPaths,
    ...userPaths,
    ...petPaths,
    ...medicalRecordPaths,
    ...appointmentPaths,
    ...medicationPaths,
    ...blockchainPaths,
    ...predictionPaths,
  },

  // ─── Components ────────────────────────────────────────────────────────────

  components: {
    // ── Security schemes ────────────────────────────────────────────────────

    securitySchemes: {
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: `
JWT access token obtained from \`POST /auth/login\` or \`POST /auth/register\`.

**Example:**
\`\`\`
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
\`\`\`

Tokens expire after 7 days. Use \`POST /auth/refresh\` to obtain a new token.
        `.trim(),
      },

      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description:
          'API key for server-to-server integrations. Contact engineering@cocohub.app to obtain a key.',
      },
    },

    // ── Schemas ─────────────────────────────────────────────────────────────

    schemas: {
      ...commonSchemas,
      ...authSchemas,
      ...userSchemas,
      ...petSchemas,
      ...medicalRecordSchemas,
      ...appointmentSchemas,
      ...medicationSchemas,
      ...blockchainSchemas,
      ...predictionSchemas,
    },

    // ── Reusable parameters ─────────────────────────────────────────────────

    parameters: {
      PageParam: {
        name: 'page',
        in: 'query',
        schema: { type: 'integer', minimum: 1, default: 1 },
        description: 'Page number for pagination',
      },
      LimitParam: {
        name: 'limit',
        in: 'query',
        schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        description: 'Number of items per page',
      },
      SortByParam: {
        name: 'sortBy',
        in: 'query',
        schema: { type: 'string' },
        description: 'Field to sort by (e.g. "createdAt", "name")',
      },
      SortOrderParam: {
        name: 'sortOrder',
        in: 'query',
        schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
        description: 'Sort direction',
      },
      UserIdParam: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'User ID (UUID)',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      },
      PetIdParam: {
        name: 'petId',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Pet ID (UUID)',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      },
      RecordIdParam: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Medical record ID (UUID)',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      },
      AppointmentIdParam: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Appointment ID (UUID)',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      },
      MedicationIdParam: {
        name: 'id',
        in: 'path',
        required: true,
        schema: { type: 'string', format: 'uuid' },
        description: 'Medication ID (UUID)',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      },
    },

    // ── Reusable responses ──────────────────────────────────────────────────

    responses: {
      BadRequest: {
        description: 'Bad request — invalid input or missing required fields',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
            example: {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid input data',
                details: { field: 'email', issue: 'Invalid email format' },
              },
              timestamp: '2024-01-15T10:30:00Z',
            },
          },
        },
      },
      Unauthorized: {
        description: 'Unauthorized — missing or invalid JWT token',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
            example: {
              success: false,
              error: { code: 'UNAUTHORIZED', message: 'Authentication required. Please log in.' },
              timestamp: '2024-01-15T10:30:00Z',
            },
          },
        },
      },
      Forbidden: {
        description: 'Forbidden — authenticated but insufficient permissions',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
            example: {
              success: false,
              error: { code: 'FORBIDDEN', message: 'Access denied.' },
              timestamp: '2024-01-15T10:30:00Z',
            },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
            example: {
              success: false,
              error: { code: 'NOT_FOUND', message: 'Resource not found.' },
              timestamp: '2024-01-15T10:30:00Z',
            },
          },
        },
      },
      TooManyRequests: {
        description: 'Rate limit exceeded',
        headers: {
          'Retry-After': {
            schema: { type: 'integer' },
            description: 'Seconds to wait before retrying',
          },
        },
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
            example: {
              success: false,
              error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait.' },
              timestamp: '2024-01-15T10:30:00Z',
            },
          },
        },
      },
      InternalServerError: {
        description: 'Internal server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ApiError' },
            example: {
              success: false,
              error: { code: 'INTERNAL_ERROR', message: 'Server error. Please try again later.' },
              timestamp: '2024-01-15T10:30:00Z',
            },
          },
        },
      },
    },
  },

  // ─── Global security (overridden per-operation where needed) ───────────────

  security: [{ BearerAuth: [] }],
} as const;

export type OpenApiSpec = typeof openApiSpec;
