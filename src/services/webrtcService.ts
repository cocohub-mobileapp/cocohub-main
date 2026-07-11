import apiClient from './apiClient';
import { getToken } from './authService';

export type ConsultationRole = 'owner' | 'vet';

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface ConsultationSummary {
  id: string;
  petId: string;
  ownerId: string;
  vetId: string;
  scheduledAt: string;
  durationMinutes: number;
  status: 'scheduled' | 'waiting' | 'in_progress' | 'completed' | 'cancelled';
  waitingRoomJoinedAt?: string;
  startedAt?: string;
  endedAt?: string;
  recordingConsent: {
    ownerConsented: boolean;
    vetConsented: boolean;
    consentedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateConsultationInput {
  petId: string;
  vetId: string;
  scheduledAt: string;
  durationMinutes?: number;
}

export interface JoinConsultationResult {
  consultationId: string;
  roomToken: string;
  iceServers: IceServerConfig[];
  waitingRoomPosition?: number;
  estimatedWaitMinutes?: number;
}

interface JwtClaims {
  sub?: string;
  role?: string;
}

function decodeJwtClaims(token: string): JwtClaims {
  const payload = token.split('.')[1];
  if (!payload) return {};
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const decoded =
    typeof globalThis.atob === 'function'
      ? globalThis.atob(padded)
      : '';
  if (!decoded) return {};
  return JSON.parse(decoded) as JwtClaims;
}

/** Resolve the authenticated user id + role from the stored JWT. */
export async function getConsultationActor(): Promise<{
  userId: string;
  role: ConsultationRole;
}> {
  const token = await getToken();
  if (!token) {
    throw new Error('You must be signed in to start a video consultation.');
  }

  const claims = decodeJwtClaims(token);
  const userId = claims.sub;
  if (!userId) {
    throw new Error('Unable to read user id from session token.');
  }

  const role: ConsultationRole = claims.role === 'vet' ? 'vet' : 'owner';
  return { userId, role };
}

export async function createConsultation(
  input: CreateConsultationInput,
): Promise<ConsultationSummary> {
  const response = await apiClient.post<{ data: ConsultationSummary }>(
    '/consultations',
    input,
  );
  return response.data.data;
}

export async function joinConsultation(
  consultationId: string,
): Promise<JoinConsultationResult> {
  const response = await apiClient.post<{ data: JoinConsultationResult }>(
    `/consultations/${encodeURIComponent(consultationId)}/join`,
  );
  return response.data.data;
}

export async function recordConsultationConsent(consultationId: string): Promise<void> {
  await apiClient.post(`/consultations/${encodeURIComponent(consultationId)}/consent`);
}

/** Build scheduledAt ISO string from telemedicine slot parts. */
export function buildScheduledAtIso(
  date: string,
  time: string,
  timeZone: string,
  fallbackUtc?: string,
): string {
  if (fallbackUtc) {
    const parsed = new Date(fallbackUtc);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }

  const candidate = new Date(`${date}T${time}:00`);
  if (!Number.isNaN(candidate.getTime())) {
    return candidate.toISOString();
  }

  throw new Error(`Unable to parse appointment time (${date} ${time}, ${timeZone}).`);
}

export function formatCallDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
