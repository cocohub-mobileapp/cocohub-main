import apiClient from './apiClient';
import type { Appointment, AppointmentType } from '../models/Appointment';

const TELEMEDICINE_ENDPOINT = '/telemedicine';
const CONSULTATIONS_ENDPOINT = '/consultations';

export interface TelemedicineAvailabilitySlot {
  date: string;
  time: string;
  display: string;
  startUtc: string;
  endUtc: string;
  timeZone: string;
}

export interface ScheduleTelemedicineAppointmentInput {
  petId: string;
  vetId: string;
  date: string;
  time: string;
  timeZone: string;
  durationMinutes?: number;
  type?: AppointmentType;
  notes?: string;
}

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export type TelemedicineUserRole = 'owner' | 'vet';

export interface ConsultationJoinInfo {
  consultationId: string;
  roomToken: string;
  iceServers: IceServer[];
  userId: string;
  userRole: TelemedicineUserRole;
  waitingRoomPosition?: number;
  estimatedWaitMinutes?: number;
}

export interface RecordingConsentInfo {
  consultationId: string;
  recordingConsent: {
    ownerId: string;
    vetId: string;
    ownerConsented: boolean;
    vetConsented: boolean;
    consentedAt?: string;
  };
  recordingEnabled: boolean;
}

export async function getTelemedicineAvailability(
  vetId: string,
  timeZone: string,
  date?: string,
): Promise<TelemedicineAvailabilitySlot[]> {
  try {
    const params = new URLSearchParams({ vetId, timeZone });
    if (date) params.set('date', date);
    const response = await apiClient.get<{ data: { slots: TelemedicineAvailabilitySlot[] } }>(
      `${TELEMEDICINE_ENDPOINT}/availability?${params.toString()}`,
    );
    return response.data.data.slots;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function scheduleTelemedicineAppointment(
  input: ScheduleTelemedicineAppointmentInput,
): Promise<Appointment> {
  try {
    const response = await apiClient.post<{ data: Appointment }>(
      `${TELEMEDICINE_ENDPOINT}/appointments`,
      input,
    );
    return response.data.data;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function joinTelemedicineConsultation(
  consultationId: string,
): Promise<ConsultationJoinInfo> {
  try {
    const response = await apiClient.post<{ data: ConsultationJoinInfo }>(
      `${CONSULTATIONS_ENDPOINT}/${encodeURIComponent(consultationId)}/join`,
      {},
    );
    return response.data.data;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function recordConsultationConsent(
  consultationId: string,
): Promise<RecordingConsentInfo> {
  try {
    const response = await apiClient.post<{ data: RecordingConsentInfo }>(
      `${CONSULTATIONS_ENDPOINT}/${encodeURIComponent(consultationId)}/consent`,
      {},
    );
    return response.data.data;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function submitTelemedicineQuestionnaire(
  appointmentId: string,
  responses: Record<string, string>,
): Promise<Appointment> {
  try {
    const response = await apiClient.post<{ data: Appointment }>(
      `${TELEMEDICINE_ENDPOINT}/${encodeURIComponent(appointmentId)}/questionnaire`,
      { responses },
    );
    return response.data.data;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function reportTelemedicineNoShow(
  appointmentId: string,
  reason?: string,
): Promise<Appointment> {
  try {
    const response = await apiClient.post<{ data: Appointment }>(
      `${TELEMEDICINE_ENDPOINT}/${encodeURIComponent(appointmentId)}/no-show`,
      { reason },
    );
    return response.data.data;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function rescheduleTelemedicineAppointment(
  appointmentId: string,
  payload: { date: string; time: string; timeZone: string },
): Promise<Appointment> {
  try {
    const response = await apiClient.post<{ data: Appointment }>(
      `${TELEMEDICINE_ENDPOINT}/${encodeURIComponent(appointmentId)}/reschedule`,
      payload,
    );
    return response.data.data;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}
