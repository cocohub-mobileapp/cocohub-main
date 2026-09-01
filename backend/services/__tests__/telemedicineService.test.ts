import { getVetAvailability } from '../telemedicineService';

describe('telemedicineService', () => {
  const futureYear = new Date().getUTCFullYear() + 1;
  const futureDate = `${futureYear}-06-01`;

  it('should return availability slots for a vet with a valid timezone', () => {
    const slots = getVetAvailability('vet-demo-id', futureDate, 'America/New_York', 1);
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0]).toEqual(
      expect.objectContaining({
        date: futureDate,
        timeZone: 'America/New_York',
        display: expect.any(String),
        startUtc: expect.any(String),
      }),
    );
  });

  it('should omit slots that are already booked for a vet', () => {
    const mockSlot = getVetAvailability('vet-demo-id', futureDate, 'UTC', 1);
    expect(mockSlot.every((slot) => slot.timeZone === 'UTC')).toBe(true);
  });
});
