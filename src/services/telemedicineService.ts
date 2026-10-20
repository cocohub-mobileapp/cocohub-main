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

// ── Consultation Lifecycle (#30) ─────────────────────────────────────────────

export async function acceptTelemedicineConsultation(
  appointmentId: string,
): Promise<{ success: boolean; appointment: any }> {
  const response = await apiClient.post(`${TELEMEDICINE_ENDPOINT}/${appointmentId}/respond`, {
    action: 'accept',
  });
  return response.data;
}

export async function declineTelemedicineConsultation(
  appointmentId: string,
  reason?: string,
): Promise<{ success: boolean; appointment: any }> {
  const response = await apiClient.post(`${TELEMEDICINE_ENDPOINT}/${appointmentId}/respond`, {
    action: 'decline',
    reason,
  });
  return response.data;
}

export async function completeTelemedicineConsultation(
  appointmentId: string,
  petId: string,
  notes: string,
  prescriptionRecommendation?: string,
): Promise<{ success: boolean; recordId: string }> {
  const response = await apiClient.post(`${TELEMEDICINE_ENDPOINT}/${appointmentId}/complete`, {
    petId,
    notes,
    prescriptionRecommendation,
  });
  return response.data;
}
