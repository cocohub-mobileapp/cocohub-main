import shamirSecretSharing from '../shamirSecretSharing';
import * as secrets from 'secrets.js-grempe';

describe('shamirSecretSharing', () => {
  it('should split and successfully combine a secret with exact threshold', () => {
    const secret = 'my super secret seed phrase';
    const shares = shamirSecretSharing.splitSecret(secret, 5, 3);
    
    expect(shares).toHaveLength(5);
    
    // Combine 3 shares (threshold)
    const combined = shamirSecretSharing.combineShares([shares[0], shares[1], shares[2]]);
    expect(combined).toBe(secret);
  });

  it('should fail to combine if threshold is not met', () => {
    const secret = 'another secret';
    const shares = shamirSecretSharing.splitSecret(secret, 5, 3);
    
    // Combine only 2 shares
    const combined = shamirSecretSharing.combineShares([shares[1], shares[4]]);
    expect(combined).not.toBe(secret);
  });

  it('should successfully combine with more than threshold shares', () => {
    const secret = 'yet another secret';
    const shares = shamirSecretSharing.splitSecret(secret, 4, 2);
    
    // Combine 4 shares (threshold is 2)
    const combined = shamirSecretSharing.combineShares(shares);
    expect(combined).toBe(secret);
  });
});
