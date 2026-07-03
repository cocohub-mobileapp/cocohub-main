export enum AppointmentStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
  COMPLETED = 'COMPLETED',
  NO_SHOW = 'NO_SHOW',
  RESCHEDULED = 'RESCHEDULED',
}

export enum AppointmentType {
  ROUTINE_CHECKUP = 'ROUTINE_CHECKUP',
  VACCINATION = 'VACCINATION',
  SURGERY = 'SURGERY',
  DENTAL = 'DENTAL',
  GROOMING = 'GROOMING',
  EMERGENCY = 'EMERGENCY',
  FOLLOW_UP = 'FOLLOW_UP',
  DIAGNOSTIC = 'DIAGNOSTIC',
  SPECIALIST_REFERRAL = 'SPECIALIST_REFERRAL',
  NUTRITION_CONSULTATION = 'NUTRITION_CONSULTATION',
}

export interface AppointmentVetSummary {
  /** Unique identifier for the veterinarian */
  vetId: string;

  /** Full name of the veterinarian */
  name: string;

  /** Vet's area of specialization (e.g., "Cardiology", "General Practice") */
  specialization?: string;

  /** Name of the clinic or hospital the vet is associated with */
  clinicName: string;

  /** Contact phone number for the clinic */
  clinicPhone?: string;

  /** Physical address of the clinic */
  clinicAddress?: string;
}

export interface AppointmentPetSummary {
  /** Unique identifier for the pet */
  petId: string;

  /** Name of the pet */
  name: string;

  /** Species of the pet (e.g., "Dog", "Cat") */
  species: string;

  /** Breed of the pet */
  breed?: string;

  /** Age of the pet in years */
  age?: number;
}

export interface AppointmentReminder {
  /** Whether the reminder is active */
  isEnabled: boolean;

  /** Number of minutes before the appointment to trigger the reminder */
  minutesBefore: number;

  /** The notification channel for the reminder */
  notificationMethod: 'push' | 'email' | 'sms';
}

export interface Appointment {
  /** Unique identifier for the appointment (UUID) */
  id: string;

  /** ID of the pet this appointment is for */
  petId: string;

  /** ID of the veterinarian assigned to this appointment */
  vetId: string;

  /**
   * Scheduled date of the appointment.
   * ISO 8601 date string format: "YYYY-MM-DD"
   */
  date: string;

  /**
   * Scheduled time of the appointment.
   * 24-hour format string: "HH:MM"
   */
  time: string;

  /**
   * Duration of the appointment in minutes.
   * Defaults to 30 minutes if not specified.
   */
  durationMinutes?: number;

  /** Category/type of the appointment */
  type: AppointmentType;

  /** Current status of the appointment */
  status: AppointmentStatus;

  /** Optional notes or reason for the appointment */
  notes?: string;

  /** Summary details of the vet involved in this appointment */
  vet?: AppointmentVetSummary;

  /** Summary details of the pet involved in this appointment */
  pet?: AppointmentPetSummary;

  /** Reminder/notification settings for this appointment */
  reminder?: AppointmentReminder;

  /**
   * Timestamp when the appointment was created.
   * ISO 8601 datetime string: "YYYY-MM-DDTHH:MM:SSZ"
   */
  createdAt: string;

  /**
   * Timestamp when the appointment was last updated.
   * ISO 8601 datetime string: "YYYY-MM-DDTHH:MM:SSZ"
   */
  updatedAt: string;

  /**
   * Timestamp when the appointment was cancelled (if applicable).
   * ISO 8601 datetime string.
   */
  cancelledAt?: string;

  /** Reason for cancellation, if the appointment was cancelled */
  cancellationReason?: string;

  /** Telemedicine appointment flag */
  isTelemedicine?: boolean;

  /** Video call link for telemedicine appointments */
  videoCallUrl?: string;

  /** Provider used to generate the video call link */
  videoProvider?: 'jitsi' | 'zoom';

  /** Timezone where the appointment is scheduled */
  timeZone?: string;

  /** UTC timestamp when the pre-consultation questionnaire is due */
  questionnaireDueAt?: string;

  /** UTC timestamp when the questionnaire was originally sent */
  questionnaireSentAt?: string;

  /** UTC timestamp when the questionnaire was responded to */
  questionnaireRespondedAt?: string;

  /** Questionnaire responses attached to the appointment */
  questionnaireResponses?: Record<string, string>;

  /** UTC timestamp when a no-show was reported */
  noShowReportedAt?: string;

  /** Previous appointment date/time when rescheduled */
  rescheduledFrom?: string;

  // ─── UI convenience fields ────────────────────────────────────────────────
  /** Human-readable title for the appointment (e.g. "Annual Checkup") */
  title?: string;
  /** Name of the pet (denormalized for display) */
  petName?: string;
  /** Name of the vet (denormalized for display) */
  vetName?: string;
  /** Location of the appointment */
  location?: string;
  /** Notification ID for cancellation */
  notificationId?: string;

  /**
   * Optional recurrence rule for repeating appointments.
   * Used by conflict detection to flag clashes across future occurrences.
   */
  recurrence?: AppointmentRecurrence;
}

export interface AppointmentRecurrence {
  frequency: 'daily' | 'weekly' | 'monthly';
  /** Repeat every N periods (default 1). */
  interval?: number;
  /** Maximum number of occurrences to materialize for conflict checks. */
  count?: number;
  /** Stop generating occurrences after this ISO date (YYYY-MM-DD). */
  until?: string;
}

export type CreateAppointmentPayload = Omit<
  Appointment,
  'id' | 'createdAt' | 'updatedAt' | 'cancelledAt' | 'vet' | 'pet'
>;

// Aliases for backward compatibility
export type CreateAppointmentInput = CreateAppointmentPayload;
export type UpdateAppointmentInput = UpdateAppointmentPayload;

export type UpdateAppointmentPayload = Partial<
  Omit<Appointment, 'id' | 'createdAt' | 'updatedAt' | 'petId' | 'vetId'>
>;

export type AppointmentSummary = Pick<
  Appointment,
  'id' | 'petId' | 'vetId' | 'date' | 'time' | 'type' | 'status'
>;

export type AppointmentDetail = Appointment & {
  vet: AppointmentVetSummary;
  pet: AppointmentPetSummary;
};

export interface AppointmentResponse {
  success: boolean;
  data: Appointment;
  message?: string;
}

export interface AppointmentListResponse {
  success: boolean;
  data: Appointment[];
  total: number;
  page?: number;
  pageSize?: number;
  message?: string;
}

export interface AppointmentFilters {
  /** Filter by one or more statuses */
  status?: AppointmentStatus | AppointmentStatus[];

  /** Filter by appointment type */
  type?: AppointmentType | AppointmentType[];

  /** Filter appointments from this date (inclusive). Format: "YYYY-MM-DD" */
  fromDate?: string;

  /** Filter appointments up to this date (inclusive). Format: "YYYY-MM-DD" */
  toDate?: string;

  /** Filter by a specific pet ID */
  petId?: string;

  /** Filter by a specific vet ID */
  vetId?: string;
}
