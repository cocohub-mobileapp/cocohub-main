import { combineShares, splitSecret } from '../shamirSecretSharing';

const SAMPLE = 'coconut wallet recovery phrase seed';

describe('shamirSecretSharing', () => {
  it('round-trips a secret when enough shares are combined', () => {
    const shares = splitSecret(SAMPLE, 5, 3);
    const restored = combineShares([shares[0], shares[2], shares[4]]);
    expect(restored).toBe(SAMPLE);
  });

  it('accepts exactly the threshold number of shares', () => {
    const shares = splitSecret(SAMPLE, 4, 2);
    expect(combineShares([shares[1], shares[3]])).toBe(SAMPLE);
  });

  it('does not reconstruct with fewer than the threshold shares', () => {
    const shares = splitSecret(SAMPLE, 5, 3);
    expect(combineShares([shares[0], shares[1]])).not.toBe(SAMPLE);
  });

  it('does not reconstruct when shares come from different splits', () => {
    const batchA = splitSecret(SAMPLE, 4, 2);
    const batchB = splitSecret('different secret entirely', 4, 2);
    expect(combineShares([batchA[0], batchB[1]])).not.toBe(SAMPLE);
  });

  it('rejects empty share arrays', () => {
    expect(() => combineShares([])).toThrow(/at least one share/i);
  });

  it('rejects blank share strings', () => {
    const shares = splitSecret(SAMPLE, 3, 2);
    expect(() => combineShares([shares[0], '   '])).toThrow(/blank/i);
  });

  it('rejects splitting an empty secret', () => {
    expect(() => splitSecret('', 3, 2)).toThrow(/empty/i);
    expect(() => splitSecret('   ', 3, 2)).toThrow(/empty/i);
  });

  it('rejects invalid share counts', () => {
    expect(() => splitSecret(SAMPLE, 2, 3)).toThrow(/shares/i);
    expect(() => splitSecret(SAMPLE, 3, 1)).toThrow(/threshold/i);
  });

  it('produces distinct shares for the same secret', () => {
    const shares = splitSecret(SAMPLE, 3, 2);
    expect(new Set(shares).size).toBe(3);
  });

  it('does not reconstruct when a decoy share replaces a valid one', () => {
    const shares = splitSecret(SAMPLE, 5, 3);
    const decoy = splitSecret('decoy phrase', 3, 2);
    expect(combineShares([shares[0], shares[1], decoy[0]])).not.toBe(SAMPLE);
  });

  it('handles unicode secrets without corruption', () => {
    const phrase = 'café 🐾 récupération';
    const shares = splitSecret(phrase, 4, 2);
    expect(combineShares([shares[0], shares[2]])).toBe(phrase);
  });

  it('handles longer mnemonics used in production-like flows', () => {
    const longPhrase =
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
    const shares = splitSecret(longPhrase, 6, 4);
    expect(combineShares(shares.slice(0, 4))).toBe(longPhrase);
  });
});
