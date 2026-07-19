import { Appointment } from '../types';

export const bufferTime = 30; // Default buffer time in minutes

export function hasConflict(appointments: Appointment[], newAppointment: Appointment, buffer: number = bufferTime): boolean {
    const startBuffer = new Date(newAppointment.start);
    startBuffer.setMinutes(startBuffer.getMinutes() - buffer);

    const endBuffer = new Date(newAppointment.end);
    endBuffer.setMinutes(endBuffer.getMinutes() + buffer);

    return appointments.some((appointment) => {
        if (appointment.recurrence) {
            // Recurring appointment
            const recurrenceEnd = new Date(appointment.recurrence.end);
            let currentDate = new Date(appointment.start);

            while (currentDate <= recurrenceEnd) {
                const recurringStart = new Date(currentDate);
                const recurringEnd = new Date(currentDate);
                recurringEnd.setMinutes(recurringEnd.getMinutes() + (appointment.end.getTime() - appointment.start.getTime()) / 60000);

                if ((startBuffer < recurringEnd && endBuffer > recurringStart)) {
                    return true;
                }

                currentDate.setDate(currentDate.getDate() + 7); // Assuming weekly recurrence
            }
        } else {
            // Single appointment
            const existingStart = new Date(appointment.start);
            const existingEnd = new Date(appointment.end);

            if ((startBuffer < existingEnd && endBuffer > existingStart)) {
                return true;
            }
        }

        return false;
    });
}

export function addAppointment(appointments: Appointment[], newAppointment: Appointment, buffer: number = bufferTime): Appointment[] {
    if (hasConflict(appointments, newAppointment, buffer)) {
        throw new Error('Appointment conflicts with an existing one.');
    }

    return [...appointments, newAppointment];
}