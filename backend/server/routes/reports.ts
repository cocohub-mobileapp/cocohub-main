/**
 * Report job queue — async PDF generation backed by Redis.
 *
 * Flow:
 *  1. POST /api/reports/pets/:petId/health → enqueues job, returns { jobId }
 *  2. GET  /api/reports/:jobId/status      → returns { status, progress?, url? }
 *  3. GET  /api/reports/:jobId/download    → streams the PDF when complete
 *
 * Job status stored in Redis with 1-hour TTL.
 * #595
 */
import express from 'express';
import { randomUUID } from 'crypto';

import { authenticateJWT, type AuthenticatedRequest } from '../../middleware/auth';
import { generateHealthReport } from '../../services/reportService';
import { sendError } from '../response';
import { store } from '../store';
import { getRedisClient } from '../../config/redis';

const router = express.Router();
router.use(authenticateJWT);

const JOB_TTL_SECONDS = 3600; // 1 hour
const JOB_KEY_PREFIX = 'cocohub:report:job:';

type JobStatus = 'queued' | 'processing' | 'complete' | 'failed';

interface JobRecord {
  jobId: string;
  status: JobStatus;
  petId: string;
  userId: string;
  filename?: string;
  recordCount?: number;
  error?: string;
  createdAt: string;
  healthScore?: number | null;
  healthStatus?: string;
  weightHistory?: Array<{ date: string; weightKg: number; note?: string }>;
  appointments?: Array<{
    id?: string;
    type: string;
    date: string;
    time?: string;
    status?: string;
    notes?: string;
    vetName?: string;
  }>;
  clinicName?: string;
}

const pdfBuffers = new Map<string, Buffer>();

async function saveJob(job: JobRecord): Promise<void> {
  const redis = getRedisClient();
  await redis.set(`${JOB_KEY_PREFIX}${job.jobId}`, JSON.stringify(job), 'EX', JOB_TTL_SECONDS);
}

async function loadJob(jobId: string): Promise<JobRecord | null> {
  const redis = getRedisClient();
  const raw = await redis.get(`${JOB_KEY_PREFIX}${jobId}`);
  return raw ? (JSON.parse(raw) as JobRecord) : null;
}

/**
 * Runs PDF generation in the background (next tick) and updates Redis job status.
 */
function processJobAsync(jobId: string): void {
  setImmediate(async () => {
    const job = await loadJob(jobId);
    if (!job) return;

    job.status = 'processing';
    await saveJob(job);

    try {
      const pet = store.pets.get(job.petId);
      const owner = pet ? store.users.get(pet.ownerId) : undefined;
      if (!pet || !owner) throw new Error('Pet or owner not found');

      const records = [...store.medicalRecords.values()].filter((r) => r.petId === job.petId);
      const medications = [...store.medications.values()].filter((m) => m.petId === job.petId);
      const defaultAppointments = [...store.appointments.values()]
        .filter((a) => a.petId === job.petId)
        .map((a) => ({
          id: a.id,
          type: a.type,
          date: a.date,
          time: a.time,
          status: a.status,
          notes: a.notes,
        }));

      const result = await generateHealthReport({
        pet,
        owner,
        records,
        medications,
        generatedBy: job.userId,
        healthScore: job.healthScore,
        healthStatus: job.healthStatus,
        weightHistory: job.weightHistory,
        appointments: job.appointments ?? defaultAppointments,
        clinicName: job.clinicName,
      });

      pdfBuffers.set(jobId, result.buffer);
      job.status = 'complete';
      job.filename = result.filename;
      job.recordCount = result.recordCount;
    } catch (err) {
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : 'Unknown error';
    }

    await saveJob(job);
  });
}

/**
 * POST /api/reports/pets/:petId/health
 * Enqueues a PDF generation job; returns { jobId } immediately, or streams PDF if sync requested.
 */
router.post('/pets/:petId/health', async (req: AuthenticatedRequest, res) => {
  const { petId } = req.params as { petId: string };

  const pet = store.pets.get(petId);
  if (!pet) return sendError(res, 404, 'NOT_FOUND', 'Pet not found');
  if (pet.ownerId !== req.user?.id) {
    return sendError(res, 403, 'FORBIDDEN', 'Only the pet owner may generate reports');
  }

  const { healthScore, healthStatus, weightHistory, appointments, clinicName } = req.body ?? {};
  const { dateFrom, dateTo, sync } = req.query as { dateFrom?: string; dateTo?: string; sync?: string };
  const isSync = sync === 'true' || req.body?.sync === true;

  const defaultAppointments = [...store.appointments.values()]
    .filter((a) => a.petId === petId)
    .map((a) => ({
      id: a.id,
      type: a.type,
      date: a.date,
      time: a.time,
      status: a.status,
      notes: a.notes,
    }));
  const resolvedAppointments = appointments ?? defaultAppointments;

  if (isSync) {
    const owner = store.users.get(pet.ownerId);
    if (!owner) return sendError(res, 404, 'NOT_FOUND', 'Owner not found');
    const records = [...store.medicalRecords.values()].filter((r) => r.petId === petId);
    const medications = [...store.medications.values()].filter((m) => m.petId === petId);
    try {
      const result = await generateHealthReport({
        pet,
        owner,
        records,
        medications,
        generatedBy: req.user?.id ?? 'unknown',
        dateFrom,
        dateTo,
        healthScore,
        healthStatus,
        weightHistory,
        appointments: resolvedAppointments,
        clinicName,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('X-Record-Count', String(result.recordCount));
      return res.send(result.buffer);
    } catch (err) {
      console.error('[reports] sync PDF generation failed:', err);
      return sendError(res, 500, 'REPORT_FAILED', 'Failed to generate health report');
    }
  }

  const jobId = randomUUID();
  const job: JobRecord = {
    jobId,
    status: 'queued',
    petId,
    userId: req.user?.id ?? 'unknown',
    createdAt: new Date().toISOString(),
    healthScore,
    healthStatus,
    weightHistory,
    appointments: resolvedAppointments,
    clinicName,
  };

  try {
    await saveJob(job);
  } catch {
    const owner = store.users.get(pet.ownerId);
    if (!owner) return sendError(res, 404, 'NOT_FOUND', 'Owner not found');
    const records = [...store.medicalRecords.values()].filter((r) => r.petId === petId);
    const medications = [...store.medications.values()].filter((m) => m.petId === petId);
    try {
      const result = await generateHealthReport({
        pet,
        owner,
        records,
        medications,
        generatedBy: req.user?.id ?? 'unknown',
        dateFrom,
        dateTo,
        healthScore,
        healthStatus,
        weightHistory,
        appointments: resolvedAppointments,
        clinicName,
      });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.setHeader('X-Record-Count', String(result.recordCount));
      return res.send(result.buffer);
    } catch (err) {
      console.error('[reports] sync PDF fallback failed:', err);
      return sendError(res, 500, 'REPORT_FAILED', 'Failed to generate health report');
    }
  }

  processJobAsync(jobId);
  res.status(202).json({ jobId });
});

/**
 * GET /api/reports/:jobId/status
 * Poll job status: { jobId, status, recordCount?, error? }
 */
router.get('/:jobId/status', async (req: AuthenticatedRequest, res) => {
  const { jobId } = req.params as { jobId: string };
  const job = await loadJob(jobId).catch(() => null);

  if (!job) return sendError(res, 404, 'NOT_FOUND', 'Job not found or expired');
  if (job.userId !== req.user?.id) return sendError(res, 403, 'FORBIDDEN', 'Access denied');

  res.json({
    jobId: job.jobId,
    status: job.status,
    recordCount: job.recordCount,
    filename: job.filename,
    error: job.error,
  });
});

/**
 * GET /api/reports/:jobId/download
 * Download the completed PDF.
 */
router.get('/:jobId/download', async (req: AuthenticatedRequest, res) => {
  const { jobId } = req.params as { jobId: string };
  const job = await loadJob(jobId).catch(() => null);

  if (!job) return sendError(res, 404, 'NOT_FOUND', 'Job not found or expired');
  if (job.userId !== req.user?.id) return sendError(res, 403, 'FORBIDDEN', 'Access denied');
  if (job.status !== 'complete') {
    return sendError(res, 409, 'NOT_READY', `Report is ${job.status}`);
  }

  const buffer = pdfBuffers.get(jobId);
  if (!buffer) return sendError(res, 410, 'GONE', 'PDF has expired from memory');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${job.filename}"`);
  res.setHeader('X-Record-Count', String(job.recordCount ?? 0));
  res.send(buffer);
});

export default router;
