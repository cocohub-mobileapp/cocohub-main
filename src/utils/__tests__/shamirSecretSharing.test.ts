import * as secrets from 'secrets.js-grempe';

import { combineShares, splitSecret } from '../shamirSecretSharing';

const MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const SECOND_MNEMONIC =
  'legal winner thank year wave sausage worth useful legal winner thank yellow';

function mutateShare(share: string): string {
  const lastChar = share[share.length - 1];
  const replacement = lastChar === 'a' ? 'b' : 'a';
  return `${share.slice(0, -1)}${replacement}`;
}

describe('shamirSecretSharing utility', () => {
  describe('split/reconstruct round-trip', () => {
    it('reconstructs the original mnemonic with the first threshold shares', () => {
      const shares = splitSecret(MNEMONIC, 5, 3);

      expect(combineShares(shares.slice(0, 3))).toBe(MNEMONIC);
    });

    it('reconstructs the original mnemonic with a non-consecutive threshold subset', () => {
      const shares = splitSecret(MNEMONIC, 5, 3);

      expect(combineShares([shares[0], shares[2], shares[4]])).toBe(MNEMONIC);
    });

    it('reconstructs a secret that contains unicode characters', () => {
      const secret = 'cocohub 🐶 secure backup seed phrase';
      const shares = splitSecret(secret, 4, 2);

      expect(combineShares([shares[1], shares[3]])).toBe(secret);
    });

    it('reconstructs when all generated shares are provided', () => {
      const shares = splitSecret(MNEMONIC, 4, 4);

      expect(combineShares(shares)).toBe(MNEMONIC);
    });
  });

  describe('threshold behavior', () => {
    it('returns the requested number of unique shares', () => {
      const shares = splitSecret(MNEMONIC, 5, 3);

      expect(shares).toHaveLength(5);
      expect(new Set(shares).size).toBe(5);
      shares.forEach((share) => {
        expect(typeof share).toBe('string');
        expect(share).toMatch(/^cocohub-v1:/);
      });
    });

    it('rejects reconstruction with fewer than the threshold number of shares', () => {
      const shares = splitSecret(MNEMONIC, 5, 3);

      expect(() => combineShares(shares.slice(0, 2))).toThrow(/invalid|corrupted/i);
    });

    it('rejects reconstruction with only one share', () => {
      const shares = splitSecret(MNEMONIC, 3, 2);

      expect(() => combineShares([shares[0]])).toThrow(/at least two shares/i);
    });

    it('rejects a threshold greater than the number of shares', () => {
      expect(() => splitSecret(MNEMONIC, 2, 3)).toThrow(/threshold/i);
    });

    it('rejects non-integer share and threshold values', () => {
      expect(() => splitSecret(MNEMONIC, 2.5, 2)).toThrow(/number of shares/i);
      expect(() => splitSecret(MNEMONIC, 3, 2.5)).toThrow(/threshold/i);
    });

    it('rejects share and threshold values lower than two', () => {
      expect(() => splitSecret(MNEMONIC, 1, 1)).toThrow(/number of shares/i);
      expect(() => splitSecret(MNEMONIC, 3, 1)).toThrow(/threshold/i);
    });
  });

  describe('wrong share rejection', () => {
    it('rejects a tampered share', () => {
      const shares = splitSecret(MNEMONIC, 3, 2);

      expect(() => combineShares([mutateShare(shares[0]), shares[1]])).toThrow(
        /invalid|corrupted/i,
      );
    });

    it('rejects shares mixed from different secrets', () => {
      const firstShares = splitSecret(MNEMONIC, 3, 2);
      const secondShares = splitSecret(SECOND_MNEMONIC, 3, 2);

      expect(() => combineShares([firstShares[0], secondShares[1]])).toThrow(/invalid|corrupted/i);
    });

    it('rejects a mix of authenticated and legacy share formats', () => {
      const authenticatedShares = splitSecret(MNEMONIC, 3, 2);
      const legacyShares = secrets.share(secrets.str2hex(MNEMONIC), 3, 2);

      expect(() => combineShares([authenticatedShares[0], legacyShares[1]])).toThrow(
        /invalid|corrupted/i,
      );
    });

    it('rejects invalid share strings', () => {
      const shares = splitSecret(MNEMONIC, 3, 2);

      expect(() => combineShares([shares[0], 'not-a-valid-share'])).toThrow(/invalid|corrupted/i);
    });

    it('rejects duplicated shares because they do not satisfy the threshold', () => {
      const shares = splitSecret(MNEMONIC, 3, 2);

      expect(() => combineShares([shares[0], shares[0]])).toThrow(/invalid|corrupted/i);
    });
  });

  describe('legacy share compatibility', () => {
    it('reconstructs shares generated before the authenticated v1 wrapper existed', () => {
      const legacyShares = secrets.share(secrets.str2hex(MNEMONIC), 5, 3);

      expect(combineShares([legacyShares[0], legacyShares[2], legacyShares[4]])).toBe(MNEMONIC);
    });
  });

  describe('empty and null input handling', () => {
    it('rejects an empty secret', () => {
      expect(() => splitSecret('', 3, 2)).toThrow(/non-empty string/i);
    });

    it('rejects a null secret', () => {
      expect(() => splitSecret(null as unknown as string, 3, 2)).toThrow(/non-empty string/i);
    });

    it('rejects an empty share array', () => {
      expect(() => combineShares([])).toThrow(/non-empty array/i);
    });

    it('rejects a null share array', () => {
      expect(() => combineShares(null as unknown as string[])).toThrow(/shares must be an array/i);
    });

    it('rejects an empty share string', () => {
      const shares = splitSecret(MNEMONIC, 3, 2);

      expect(() => combineShares([shares[0], ''])).toThrow(/non-empty string/i);
    });
  });
});
