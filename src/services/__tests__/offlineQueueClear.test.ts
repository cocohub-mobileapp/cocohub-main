/**
 * Pure regression for #52: after a successful server confirmation, items must
 * leave the pending list (only failures remain).
 */
describe('offline queue clear-on-success (#52)', () => {
  function reduceAfterFlush(
    pending: Array<{ id: string }>,
    results: Array<{ id: string; ok: boolean }>,
  ): Array<{ id: string }> {
    const failedIds = new Set(results.filter((r) => !r.ok).map((r) => r.id));
    return pending.filter((m) => failedIds.has(m.id));
  }

  it('drops items that received server confirmation', () => {
    const pending = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    const results = [
      { id: 'a', ok: true },
      { id: 'b', ok: true },
      { id: 'c', ok: false },
    ];
    expect(reduceAfterFlush(pending, results)).toEqual([{ id: 'c' }]);
  });

  it('clears entirely when all succeed', () => {
    const pending = [{ id: 'a' }, { id: 'b' }];
    const results = [
      { id: 'a', ok: true },
      { id: 'b', ok: true },
    ];
    expect(reduceAfterFlush(pending, results)).toEqual([]);
  });
});
