import apiClient from './apiClient';
import type { Appointment, AppointmentType } from '../models/Appointment';

const TELEMEDICINE_ENDPOINT = '/telemedicine';

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

export interface TelemedicineJoinSession {
  consultationId: string;
  roomToken: string;
  userId: string;
  userRole: 'owner' | 'vet';
  iceServers: Array<{ urls: string | string[]; username?: string; credential?: string }>;
  waitingRoomPosition?: number;
  estimatedWaitMinutes?: number;
}

export interface TelemedicineDecisionResponse {
  consultation: {
    id: string;
    vetDecision?: 'accepted' | 'declined';
    vetDecisionAt?: string;
    vetDecisionReason?: string;
  };
  appointment?: Appointment;
}

export interface TelemedicineConsultationNoteInput {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
  notes?: string;
}

export interface TelemedicineConsultationNoteResponse {
  record: {
    id: string;
    petId: string;
    vetId: string;
    type: string;
    diagnosis?: string;
    treatment?: string;
    notes?: string;
    visitDate: string;
    createdAt: string;
    updatedAt: string;
  };
  appointment?: Appointment;
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

export async function joinTelemedicineConsultation(
  consultationId: string,
): Promise<TelemedicineJoinSession> {
  try {
    const response = await apiClient.post<{ data: TelemedicineJoinSession }>(
      `/consultations/${encodeURIComponent(consultationId)}/join`,
    );
    return response.data.data;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function respondToTelemedicineConsultation(
  consultationId: string,
  decision: 'accepted' | 'declined',
  reason?: string,
): Promise<TelemedicineDecisionResponse> {
  try {
    const response = await apiClient.post<{ data: TelemedicineDecisionResponse }>(
      `/consultations/${encodeURIComponent(consultationId)}/decision`,
      { decision, reason },
    );
    return response.data.data;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error));
  }
}

export async function saveTelemedicineConsultationNote(
  consultationId: string,
  input: TelemedicineConsultationNoteInput,
): Promise<TelemedicineConsultationNoteResponse> {
  try {
    const response = await apiClient.post<{ data: TelemedicineConsultationNoteResponse }>(
      `/consultations/${encodeURIComponent(consultationId)}/notes`,
      input,
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
