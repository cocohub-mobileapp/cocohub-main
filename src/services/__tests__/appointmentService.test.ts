import { Appointment } from '../../types';
import { hasConflict, addAppointment } from '../appointmentService';

describe('Appointment Service', () => {
    const baseAppointments: Appointment[] = [
        { id: '1', title: 'Meeting 1', start: '2023-10-01T10:00:00', end: '2023-10-01T11:00:00', recurrence: null },
        { id: '2', title: 'Meeting 2', start: '2023-10-01T12:00:00', end: '2023-10-01T13:00:00', recurrence: null },
        { id: '3', title: 'Recurring Meeting', start: '2023-10-01T14:00:00', end: '2023-10-01T15:00:00', recurrence: { end: '2023-10-29T15:00:00' } },
    ];

    test('should detect overlapping appointments on the same day', () => {
        const newAppointment: Appointment = { id: '4', title: 'Meeting 4', start: '2023-10-01T10:30:00', end: '2023-10-01T11:30:00', recurrence: null };
        expect(hasConflict(baseAppointments, newAppointment)).toBe(true);
    });

    test('should allow configurable buffer time between appointments', () => {
        const newAppointment: Appointment = { id: '5', title: 'Meeting 5', start: '2023-10-01T11:30:00', end: '2023-10-01T12:30:00', recurrence: null };
        expect(hasConflict(baseAppointments, newAppointment, 30)).toBe(true);
        expect(hasConflict(baseAppointments, newAppointment, 0)).toBe(false);
    });

    test('should detect conflicts with recurring appointments', () => {
        const newAppointment: Appointment = { id: '6', title: 'Meeting 6', start: '2023-10-08T14:30:00', end: '2023-10-08T15:30:00', recurrence: null };
        expect(hasConflict(baseAppointments, newAppointment)).toBe(true);
    });

    test('should not add conflicting appointment', () => {
        const newAppointment: Appointment = { id: '7', title: 'Meeting 7', start: '2023-10-01T10:30:00', end: '2023-10-01T11:30:00', recurrence: null };
        expect(() => addAppointment(baseAppointments, newAppointment)).toThrow('Appointment conflicts with an existing one.');
    });
})