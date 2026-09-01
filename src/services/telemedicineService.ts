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

/** Vet accepts a pending appointment. */
export async function acceptTelemedicineAppointment(appointmentId: string): Promise<Appointment> {
  const response = await apiClient.patch<{ data: Appointment }>(
    `${TELEMEDICINE_ENDPOINT}/${encodeURIComponent(appointmentId)}/accept`,
  );
  return response.data.data;
}

/** Vet declines a pending appointment. */
export async function declineTelemedicineAppointment(
  appointmentId: string,
  reason?: string,
): Promise<Appointment> {
  const response = await apiClient.patch<{ data: Appointment }>(
    `${TELEMEDICINE_ENDPOINT}/${encodeURIComponent(appointmentId)}/decline`,
    { reason },
  );
  return response.data.data;
}

/** Marks a telemedicine call as complete and saves consultation notes. */
export async function completeTelemedicineCall(
  appointmentId: string,
  consultationNotes: string,
  diagnosis?: string,
  treatment?: string,
): Promise<{ appointment: Appointment; medicalRecordId: string }> {
  const response = await apiClient.post<{
    data: { appointment: Appointment; medicalRecordId: string };
  }>(`${TELEMEDICINE_ENDPOINT}/${encodeURIComponent(appointmentId)}/complete`, {
    consultationNotes,
    diagnosis,
    treatment,
  });
  return response.data.data;
}
