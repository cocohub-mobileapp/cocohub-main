import { splitSecret, combineShares } from '../shamirSecretSharing';

describe('shamirSecretSharing', () => {
  const SECRET = 'correct horse battery staple fatal river mistake';
  const N = 5;
  const K = 3;

  describe('splitSecret', () => {
    it('returns the requested number of shares', () => {
      const shares = splitSecret(SECRET, N, K);
      expect(shares).toHaveLength(N);
    });

    it('produces unique shares that do not contain the secret', () => {
      const shares = splitSecret(SECRET, N, K);
      expect(new Set(shares).size).toBe(N);
      for (const share of shares) {
        expect(share.length).toBeGreaterThan(0);
        expect(share).not.toBe(SECRET);
        expect(share).not.toContain(SECRET);
      }
    });
    it('produces shares in grempe v2 format ("8" + 2-hex share id + hex payload)', () => {
      const shares = splitSecret(SECRET, N, K);
      const ids = new Set<number>();
      for (const share of shares) {
        expect(share).toMatch(/^8[0-9a-f]{2}[0-9a-f]+$/);
        ids.add(parseInt(share.slice(1, 3), 16));
      }
      expect(ids.size).toBe(N);
    });

    it('is randomized: two splits of the same secret differ', () => {
      const first = splitSecret(SECRET, N, K);
      const second = splitSecret(SECRET, N, K);
      expect(first.slice().sort().join(',')).not.toBe(second.slice().sort().join(','));
    });

    it('rejects a threshold below 2', () => {
      expect(() => splitSecret(SECRET, 3, 1)).toThrow();
    });

    it('rejects a threshold greater than the number of shares', () => {
      expect(() => splitSecret(SECRET, 3, 4)).toThrow();
    });

    it('supports n-of-n; a missing share breaks reconstruction', () => {
      const shares = splitSecret(SECRET, 4, 4);
      expect(combineShares(shares)).toBe(SECRET);
      expect(combineShares(shares.slice(0, 3))).not.toBe(SECRET);
    });
  });

  describe('combineShares', () => {
    it('reconstructs the original secret from exactly k shares', () => {
      const shares = splitSecret(SECRET, N, K);
      expect(combineShares(shares.slice(0, K))).toBe(SECRET);
    });

    it('round-trips any subset of shares with length at or above k', () => {
      const shares = splitSecret(SECRET, N, K);
      const subsets = [shares.slice(0, K), shares.slice(1, N), shares.slice(0, N)];
      for (const subset of subsets) {
        expect(combineShares(subset)).toBe(SECRET);
      }
    });

    it('round-trips a 2-of-3 scheme even with shuffled share order', () => {
      const secret = 'cocohub-wallet-key';
      const shares = splitSecret(secret, 3, 2);
      expect(combineShares([shares[0], shares[2]])).toBe(secret);
      expect(combineShares([shares[2], shares[1]])).toBe(secret);
    });

    it('does NOT reconstruct the secret from fewer shares than k', () => {
      const shares = splitSecret(SECRET, N, K);
      expect(combineShares(shares.slice(0, K - 1))).not.toBe(SECRET);
    });

    it('yields garbage (not the secret) when one share is tampered with', () => {
      const shares = splitSecret(SECRET, N, K);
      const first = shares[0];
      const flipped = first.slice(-1) === '0' ? '1' : '0';
      const tampered = [first.slice(0, -1) + flipped, ...shares.slice(1, K)];
      expect(combineShares(tampered)).not.toBe(SECRET);
    });

    it('does not reconstruct the secret when shares from different splits are mixed', () => {
      const first = splitSecret(SECRET, N, K);
      const second = splitSecret(SECRET, N, K);
      const mixed = [first[0], first[1], second[2]];
      expect(combineShares(mixed)).not.toBe(SECRET);
    });

    it('does not return any previously generated share when epochs are mixed', () => {
      const first = splitSecret(SECRET, N, K);
      const second = splitSecret(SECRET, N, K);
      const out = combineShares([first[0], second[1], second[2]]);
      expect(out).not.toBe(SECRET);
      expect(first).not.toContain(out);
      expect(second).not.toContain(out);
    });

    it('throws on a bogus non-hex share mixed with valid shares', () => {
      const shares = splitSecret(SECRET, N, K);
      const mixed = [...shares.slice(0, K - 1), 'not-a-valid-share'];
      expect(() => combineShares(mixed)).toThrow();
    });

    it('handles an empty secret without crashing and round-trips it', () => {
      const shares = splitSecret('', 3, 2);
      expect(shares).toHaveLength(3);
      expect(combineShares(shares.slice(0, 2))).toBe('');
    });

    it('round-trips unicode secrets (emoji, CJK, accented characters)', () => {
      const secret = '🔑 kunci péta こんにちは 世界 ✅';
      const shares = splitSecret(secret, 4, 2);
      expect(combineShares(shares.slice(1, 3))).toBe(secret);
    });

    it('round-trips a long 24-word style recovery phrase', () => {
      const secret = Array.from({ length: 24 }, (_, i) => 'word' + i + 'x'.repeat(i % 5)).join(' ');
      const shares = splitSecret(secret, 5, 3);
      expect(combineShares(shares.slice(2, 5))).toBe(secret);
    });

    it('round-trips a single-character secret', () => {
      const shares = splitSecret('x', 3, 2);
      expect(combineShares(shares.slice(0, 2))).toBe('x');
    });

    it('round-trips secrets with whitespace and special characters', () => {
      const secret = 'p@$$w0rd with\ttabs\nand newlines & <html> "quotes"';
      const shares = splitSecret(secret, 3, 3);
      expect(combineShares(shares)).toBe(secret);
    });
  });
});
