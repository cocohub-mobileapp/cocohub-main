import { Appointment } from '../types'; // Assuming a type definition exists

// Configuration for appointment settings
export const APPOINTMENT_CONFIG = {
  DEFAULT_BUFFER_MINUTES: 30,
};

/**
 * Checks if two time ranges overlap, considering a buffer time.
 * 
 * @param startA - Start time of first appointment
 * @param endA - End time of first appointment
 * @param startB - Start time of second appointment
 * @param endB - End time of second appointment
 * @param bufferMinutes - Buffer time in minutes between appointments
 * @returns boolean indicating if they conflict
 */
export function hasTimeConflict(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
  bufferMinutes: number = APPOINTMENT_CONFIG.DEFAULT_BUFFER_MINUTES
): boolean {
  const bufferMs = bufferMinutes * 60 * 1000;
  
  // Adjust times with buffer
  const adjustedStartA = new Date(startA.getTime() - bufferMs);
  const adjustedEndA = new Date(endA.getTime() + bufferMs);
  const adjustedStartB = new Date(startB.getTime() - bufferMs);
  const adjustedEndB = new Date(endB.getTime() + bufferMs);

  // Overlap condition: A starts before B ends AND A ends after B starts
  return adjustedStartA < adjustedEndB && adjustedEndA > adjustedStartB;
}

/**
 * Generates all instances of a recurring appointment within a date range.
 * This is a simplified implementation. In a real app, you might use a library like 'rrule'.
 * 
 * @param appointment - The recurring appointment object
 * @param startDate - Start of the search window
 * @param endDate - End of the search window
 * @returns Array of generated appointment instances
 */
export function generateRecurringInstances(
  appointment: Appointment,
  startDate: Date,
  endDate: Date
): Appointment[] {
  if (!appointment.isRecurring) {
    return [appointment];
  }

  const instances: Appointment[] = [];
  let currentDate = new Date(startDate);
  
  // Simple daily recurrence for demonstration. 
  // Real-world would handle weekly, monthly, etc., based on appointment.recurrenceRule
  while (currentDate <= endDate) {
    // Check if this day matches the recurrence pattern (e.g., every Monday)
    // For simplicity, assuming daily recurrence or specific days if provided
    if (appointment.recurrenceDays?.includes(currentDate.getDay()) || !appointment.recurrenceDays) {
      const instance = {
        ...appointment,
        id: `${appointment.id}-${currentDate.toISOString().split('T')[0]}`, // Unique ID for instance
        startTime: new Date(currentDate.setHours(appointment.startTime.getHours(), appointment.startTime.getMinutes())),
        endTime: new Date(currentDate.setHours(appointment.endTime.getHours(), appointment.endTime.getMinutes())),
        isRecurringInstance: true,
      };
      instances.push(instance);
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return instances;
}

/**
 * Checks for conflicts between a new appointment and a list of existing appointments.
 * Handles both single and recurring appointments.
 * 
 * @param newAppointment - The appointment being saved/edited
 * @param existingAppointments - List of currently stored appointments
 * @param bufferMinutes - Optional buffer time override
 * @returns Array of conflicting appointments
 */
export function findConflicts(
  newAppointment: Appointment,
  existingAppointments: Appointment[],
  bufferMinutes: number = APPOINTMENT_CONFIG.DEFAULT_BUFFER_MINUTES
): Appointment[] {
  const conflicts: Appointment[] = [];
  
  // Determine the date range to check. 
  // If new appointment is recurring, we might want to check a wider window, 
  // but for immediate save, we usually check against existing static instances.
  const checkStartDate = newAppointment.startTime;
  const checkEndDate = newAppointment.endTime;

  // If the new appointment is recurring, we should check against potential future slots too?
  // For now, we check against existing appointments in the DB.
  
  for (const existing of existingAppointments) {
    // Skip self-editing
    if (existing.id === newAppointment.id) continue;

    let existingInstances: Appointment[] = [];
    let newInstances: Appointment[] = [];

    // Expand recurring appointments if necessary
    if (existing.isRecurring) {
      // Generate instances for existing around the new appointment's time
      const windowStart = new Date(checkStartDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days prior
      const windowEnd = new Date(checkEndDate.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days later
      existingInstances = generateRecurringInstances(existing, windowStart, windowEnd);
    } else {
      existingInstances = [existing];
    }

    if (newAppointment.isRecurring) {
      const windowStart = new Date(checkStartDate.getTime() - 7 * 24 * 60 * 60 * 1000);
      const windowEnd = new Date(checkEndDate.getTime() + 7 * 24 * 60 * 60 * 1000);
      newInstances = generateRecurringInstances(newAppointment, windowStart, windowEnd);
    } else {
      newInstances = [newAppointment];
    }

    // Compare each instance
    for (const instNew of newInstances) {
      for (const instExisting of existingInstances) {
        if (hasTimeConflict(
          instNew.startTime,
          instNew.endTime,
          instExisting.startTime,
          instExisting.endTime,
          bufferMinutes
        )) {
          // Avoid adding duplicate conflicts
          if (!conflicts.find(c => c.id === instExisting.id)) {
            conflicts.push(instExisting);
          }
        }
      }
    }
  }

  return conflicts;
}
