import {
  intervalsOverlap,
  appointmentInterval,
  expandWeeklyRecurrence,
  setConflictBufferMinutes,
  getConflictBufferMinutes,
  DEFAULT_CONFLICT_BUFFER_MINUTES,
} from '../appointmentService';

describe('appointment conflict helpers (#49)', () => {
  it('defaults buffer to 30 minutes', () => {
    setConflictBufferMinutes(DEFAULT_CONFLICT_BUFFER_MINUTES);
    expect(getConflictBufferMinutes()).toBe(30);
  });

  it('detects overlapping intervals on same day (not only exact time)', () => {
    const a = appointmentInterval(new Date('2026-07-20T10:00:00Z'), 60);
    const b = appointmentInterval(new Date('2026-07-20T10:30:00Z'), 30);
    expect(intervalsOverlap(a, b, 0)).toBe(true);
  });

  it('applies buffer between back-to-back appointments', () => {
    const a = appointmentInterval(new Date('2026-07-20T10:00:00Z'), 30);
    const b = appointmentInterval(new Date('2026-07-20T10:45:00Z'), 30);
    // 15 min gap, 30 min buffer pad => overlap
    expect(intervalsOverlap(a, b, 30 * 60 * 1000)).toBe(true);
    // exact end-to-start without pad
    const c = appointmentInterval(new Date('2026-07-20T10:30:00Z'), 30);
    expect(intervalsOverlap(a, c, 0)).toBe(false);
  });

  it('expands weekly recurrence into window', () => {
    const seed = new Date('2026-07-06T15:00:00Z'); // Monday
    const start = new Date('2026-07-20T00:00:00Z');
    const end = new Date('2026-07-20T23:59:59Z');
    const occ = expandWeeklyRecurrence(seed, start, end);
    expect(occ.length).toBeGreaterThanOrEqual(1);
    expect(occ[0].getUTCDay()).toBe(seed.getUTCDay());
  });

  it('allows configuring buffer minutes', () => {
    setConflictBufferMinutes(15);
    expect(getConflictBufferMinutes()).toBe(15);
    setConflictBufferMinutes(30);
  });
});
