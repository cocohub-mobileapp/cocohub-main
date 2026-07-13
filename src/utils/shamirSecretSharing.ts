import * as secrets from 'secrets.js-grempe';

function assertShareCount(shares: number, threshold: number): void {
  if (threshold < 2) {
    throw new Error('Threshold must be at least 2');
  }
  if (shares < threshold) {
    throw new Error('Total shares must be greater than or equal to the threshold');
  }
}

export function splitSecret(mnemonic: string, shares: number, threshold: number): string[] {
  if (!mnemonic?.trim()) {
    throw new Error('Secret cannot be empty');
  }
  assertShareCount(shares, threshold);

  const hex = secrets.str2hex(mnemonic);
  return secrets.share(hex, shares, threshold);
}

export function combineShares(sharesArr: string[]): string {
  if (!sharesArr?.length) {
    throw new Error('At least one share is required');
  }
  if (sharesArr.some((share) => !share?.trim())) {
    throw new Error('Share cannot be blank');
  }

  const hex = secrets.combine(sharesArr);
  return secrets.hex2str(hex);
}

export default { splitSecret, combineShares };
