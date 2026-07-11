import {
  buildScheduledAtIso,
  formatCallDuration,
} from '../webrtcService';

describe('webrtcService helpers', () => {
  it('formats call duration as MM:SS', () => {
    expect(formatCallDuration(0)).toBe('00:00');
    expect(formatCallDuration(65)).toBe('01:05');
    expect(formatCallDuration(3723)).toBe('62:03');
  });

  it('builds scheduledAt from slot UTC when provided', () => {
    const iso = buildScheduledAtIso('2026-06-15', '10:00', 'UTC', '2026-06-15T10:00:00.000Z');
    expect(iso).toBe('2026-06-15T10:00:00.000Z');
  });

  it('builds scheduledAt from date and time fallback', () => {
    const iso = buildScheduledAtIso('2026-06-15', '10:00', 'UTC');
    expect(iso).toContain('2026-06-15');
  });
});
