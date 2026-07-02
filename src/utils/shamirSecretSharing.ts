import * as secrets from 'secrets.js-grempe';

const MIN_SHARES = 2;
const MAX_SHARES = 255;

function validateSecret(mnemonic: string): void {
  if (typeof mnemonic !== 'string' || mnemonic.trim().length === 0) {
    throw new Error('Secret must be a non-empty string');
  }
}

function validateShareConfig(shares: number, threshold: number): void {
  if (!Number.isInteger(shares) || shares < MIN_SHARES || shares > MAX_SHARES) {
    throw new Error('Number of shares must be an integer from 2 to 255');
  }

  if (!Number.isInteger(threshold) || threshold < MIN_SHARES || threshold > shares) {
    throw new Error('Threshold must be an integer from 2 to shares');
  }
}

function validateShares(sharesArr: string[]): void {
  if (!Array.isArray(sharesArr) || sharesArr.length < MIN_SHARES) {
    throw new Error('At least two shares are required to combine a secret');
  }

  if (sharesArr.some((share) => typeof share !== 'string' || share.trim().length === 0)) {
    throw new Error('Shares must be non-empty strings');
  }
}

export function splitSecret(mnemonic: string, shares: number, threshold: number): string[] {
  validateSecret(mnemonic);
  validateShareConfig(shares, threshold);

  // convert to hex
  const hex = secrets.str2hex(mnemonic);
  // generate shares
  const parts = secrets.share(hex, shares, threshold);
  return parts;
}

export function combineShares(sharesArr: string[]): string {
  validateShares(sharesArr);

  const hex = secrets.combine(sharesArr);
  const str = secrets.hex2str(hex);
  return str;
}

export default { splitSecret, combineShares };
