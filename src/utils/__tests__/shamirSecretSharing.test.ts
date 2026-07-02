import { combineShares, splitSecret } from '../shamirSecretSharing';

describe('shamirSecretSharing utils', () => {
  const mnemonic =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  it('splits a mnemonic into the requested number of shares', () => {
    const shares = splitSecret(mnemonic, 5, 3);

    expect(shares).toHaveLength(5);
  });

  it('creates unique non-empty shares', () => {
    const shares = splitSecret(mnemonic, 5, 3);

    expect(new Set(shares).size).toBe(shares.length);
    expect(shares.every((share) => typeof share === 'string' && share.length > 0)).toBe(true);
  });

  it('reconstructs the original mnemonic from a threshold subset', () => {
    const shares = splitSecret(mnemonic, 5, 3);

    expect(combineShares(shares.slice(0, 3))).toBe(mnemonic);
  });

  it('reconstructs the original mnemonic from a different threshold subset', () => {
    const shares = splitSecret(mnemonic, 5, 3);

    expect(combineShares([shares[0], shares[2], shares[4]])).toBe(mnemonic);
  });

  it('reconstructs the original mnemonic when all generated shares are provided', () => {
    const shares = splitSecret(mnemonic, 5, 3);

    expect(combineShares(shares)).toBe(mnemonic);
  });

  it('supports the minimum threshold of two shares', () => {
    const shares = splitSecret(mnemonic, 3, 2);

    expect(combineShares(shares.slice(0, 2))).toBe(mnemonic);
  });

  it('does not reconstruct the original mnemonic from mixed shares', () => {
    const firstSecretShares = splitSecret(mnemonic, 5, 3);
    const secondSecretShares = splitSecret(
      'zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo zoo wrong',
      5,
      3,
    );

    expect(
      combineShares([firstSecretShares[0], firstSecretShares[1], secondSecretShares[2]]),
    ).not.toBe(mnemonic);
  });

  it('rejects malformed shares', () => {
    const shares = splitSecret(mnemonic, 3, 2);

    expect(() => combineShares([shares[0], 'not-a-valid-share'])).toThrow(/invalid share/i);
  });

  it('rejects an empty mnemonic', () => {
    expect(() => splitSecret('', 3, 2)).toThrow('Secret must be a non-empty string');
  });

  it('rejects a whitespace-only mnemonic', () => {
    expect(() => splitSecret('   ', 3, 2)).toThrow('Secret must be a non-empty string');
  });

  it('rejects a null mnemonic', () => {
    expect(() => splitSecret(null as unknown as string, 3, 2)).toThrow(
      'Secret must be a non-empty string',
    );
  });

  it('rejects fewer than two generated shares', () => {
    expect(() => splitSecret(mnemonic, 1, 1)).toThrow(
      'Number of shares must be an integer from 2 to 255',
    );
  });

  it('rejects a threshold below two', () => {
    expect(() => splitSecret(mnemonic, 3, 1)).toThrow(
      'Threshold must be an integer from 2 to shares',
    );
  });

  it('rejects a threshold greater than the generated shares', () => {
    expect(() => splitSecret(mnemonic, 2, 3)).toThrow(
      'Threshold must be an integer from 2 to shares',
    );
  });

  it('rejects an empty share list', () => {
    expect(() => combineShares([])).toThrow('At least two shares are required to combine a secret');
  });

  it('rejects a null share list', () => {
    expect(() => combineShares(null as unknown as string[])).toThrow(
      'At least two shares are required to combine a secret',
    );
  });

  it('rejects empty share values', () => {
    const shares = splitSecret(mnemonic, 3, 2);

    expect(() => combineShares([shares[0], ''])).toThrow('Shares must be non-empty strings');
  });
});
