import { getVetAvailability } from '../telemedicineService';
import { AppointmentStatus, AppointmentType } from '../../models/Appointment';
import { store } from '../../server/store';

function futureDate(daysAhead = 30): string {
  return new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10);
}

describe('telemedicineService', () => {
  afterEach(() => {
    store.appointments.delete('telemedicine-service-booked-slot');
  });

  it('should return availability slots for a vet with a valid timezone', () => {
    const date = futureDate();
    const slots = getVetAvailability('vet-demo-id', date, 'America/New_York', 1);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]).toEqual(
      expect.objectContaining({
        date,
        timeZone: 'America/New_York',
        display: expect.any(String),
        startUtc: expect.any(String),
      }),
    );
  });

  it('should omit slots that are already booked for a vet', () => {
    const date = futureDate(31);
    const [slot] = getVetAvailability('vet-booked-id', date, 'UTC', 1);
    expect(slot).toBeDefined();

    store.appointments.set('telemedicine-service-booked-slot', {
      id: 'telemedicine-service-booked-slot',
      petId: 'p-demo-1',
      vetId: 'vet-booked-id',
      date: slot.date,
      time: slot.time,
      durationMinutes: 30,
      type: AppointmentType.ROUTINE_CHECKUP,
      status: AppointmentStatus.CONFIRMED,
      timeZone: 'UTC',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const remainingSlots = getVetAvailability('vet-booked-id', date, 'UTC', 1);
    expect(remainingSlots).not.toContainEqual(
      expect.objectContaining({ date: slot.date, time: slot.time }),
    );
  });
});
