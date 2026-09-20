import { splitSecret, combineShares } from '../shamirSecretSharing';

describe('shamirSecretSharing', () => {
  const SAMPLE_MNEMONIC =
    'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
  const SAMPLE_24_WORDS =
    'legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth useful legal winner thank year wave sausage worth title';

  describe('splitSecret and combineShares round-trip', () => {
    it('1. successfully splits and reconstructs a 12-word BIP-39 mnemonic with 3-of-5 scheme', () => {
      const shares = splitSecret(SAMPLE_MNEMONIC, 5, 3);
      expect(shares).toHaveLength(5);

      const recovered = combineShares(shares.slice(0, 3));
      expect(recovered).toBe(SAMPLE_MNEMONIC);
    });

    it('2. successfully splits and reconstructs a 24-word mnemonic', () => {
      const shares = splitSecret(SAMPLE_24_WORDS, 4, 2);
      expect(shares).toHaveLength(4);

      const recovered = combineShares([shares[1], shares[3]]);
      expect(recovered).toBe(SAMPLE_24_WORDS);
    });

    it('3. reconstructs secret using any valid subset meeting the threshold (subset A: [0, 2, 4])', () => {
      const shares = splitSecret(SAMPLE_MNEMONIC, 5, 3);
      const recovered = combineShares([shares[0], shares[2], shares[4]]);
      expect(recovered).toBe(SAMPLE_MNEMONIC);
    });

    it('4. reconstructs secret using any valid subset meeting the threshold (subset B: [1, 2, 3])', () => {
      const shares = splitSecret(SAMPLE_MNEMONIC, 5, 3);
      const recovered = combineShares([shares[1], shares[2], shares[3]]);
      expect(recovered).toBe(SAMPLE_MNEMONIC);
    });

    it('5. reconstructs secret when threshold equals total shares (N-of-N, e.g. 3-of-3)', () => {
      const shares = splitSecret(SAMPLE_MNEMONIC, 3, 3);
      expect(shares).toHaveLength(3);

      const recovered = combineShares(shares);
      expect(recovered).toBe(SAMPLE_MNEMONIC);
    });

    it('6. works with minimal 2-of-2 threshold scheme', () => {
      const secret = 'super-secret-wallet-key-12345';
      const shares = splitSecret(secret, 2, 2);
      expect(shares).toHaveLength(2);

      const recovered = combineShares(shares);
      expect(recovered).toBe(secret);
    });

    it('7. preserves UTF-8 unicode and special characters', () => {
      const complexSecret = 'Pét-Care_2026! @#$%^&*()_+ 🐱🐶🩺';
      const shares = splitSecret(complexSecret, 5, 3);
      const recovered = combineShares(shares.slice(0, 3));
      expect(recovered).toBe(complexSecret);
    });

    it('8. handles short single-character secrets', () => {
      const singleChar = 'X';
      const shares = splitSecret(singleChar, 3, 2);
      const recovered = combineShares([shares[0], shares[1]]);
      expect(recovered).toBe(singleChar);
    });

    it('9. handles higher share counts and thresholds (e.g. 6-of-10)', () => {
      const shares = splitSecret(SAMPLE_MNEMONIC, 10, 6);
      expect(shares).toHaveLength(10);

      const selected = [shares[0], shares[2], shares[4], shares[6], shares[8], shares[9]];
      const recovered = combineShares(selected);
      expect(recovered).toBe(SAMPLE_MNEMONIC);
    });
  });

  describe('security and threshold boundaries', () => {
    it('10. fails to reconstruct original secret when fewer shares than threshold are provided', () => {
      const shares = splitSecret(SAMPLE_MNEMONIC, 5, 3);
      // Only provide 2 shares when 3 are required
      const underThreshold = shares.slice(0, 2);
      const recovered = combineShares(underThreshold);
      expect(recovered).not.toBe(SAMPLE_MNEMONIC);
    });

    it('11. fails or rejects when a share is tampered or corrupted', () => {
      const shares = splitSecret(SAMPLE_MNEMONIC, 5, 3);
      // Corrupt one share by altering hex digits
      const corruptedShare = shares[0].slice(0, -4) + '0000';
      const recovered = combineShares([corruptedShare, shares[1], shares[2]]);
      expect(recovered).not.toBe(SAMPLE_MNEMONIC);
    });

    it('12. duplicate shares do not count towards meeting the threshold', () => {
      const shares = splitSecret(SAMPLE_MNEMONIC, 5, 3);
      // Provide same share twice + 1 other (total 2 unique shares instead of 3)
      const duplicates = [shares[0], shares[0], shares[1]];
      const recovered = combineShares(duplicates);
      expect(recovered).not.toBe(SAMPLE_MNEMONIC);
    });

    it('13. completely invalid shares result in empty or garbled output without crashing', () => {
      const invalidShares = ['80101abcd', '80201dcba'];
      expect(() => {
        const result = combineShares(invalidShares);
        expect(typeof result).toBe('string');
      }).not.toThrow();
    });
  });

  describe('edge cases and empty inputs', () => {
    it('14. handles empty string input gracefully', () => {
      const shares = splitSecret('', 3, 2);
      expect(Array.isArray(shares)).toBe(true);
      const recovered = combineShares(shares.slice(0, 2));
      expect(recovered).toBe('');
    });

    it('15. handles empty shares array in combineShares without unhandled exception', () => {
      expect(() => {
        const result = combineShares([]);
        expect(result).toBe('');
      }).not.toThrow();
    });

    it('16. verified split produces unique non-identical shares', () => {
      const shares = splitSecret(SAMPLE_MNEMONIC, 5, 3);
      const unique = new Set(shares);
      expect(unique.size).toBe(5);
    });
  });
});
