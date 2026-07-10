import CryptoJS from 'crypto-js';
import * as secrets from 'secrets.js-grempe';

const PAYLOAD_VERSION = 1;
const CHECKSUM_CONTEXT = 'cocohub-shamirSecretSharing';
const SHARE_PREFIX = 'cocohub-v1:';
const MIN_SHARES = 2;
const MAX_SHARES = 255;

type SecretPayload = {
  version: number;
  secret: string;
  checksum: string;
};

function assertNonEmptyString(value: unknown, fieldName: string): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string`);
  }
}

function assertValidShareConfig(shares: number, threshold: number): void {
  if (!Number.isInteger(shares) || shares < MIN_SHARES || shares > MAX_SHARES) {
    throw new Error('Number of shares must be an integer from 2 to 255');
  }

  if (!Number.isInteger(threshold) || threshold < MIN_SHARES || threshold > shares) {
    throw new Error('Threshold must be an integer from 2 to shares');
  }
}

function createChecksum(secret: string): string {
  return CryptoJS.SHA256(`${CHECKSUM_CONTEXT}:${secret}`).toString(CryptoJS.enc.Hex);
}

function createPayload(secret: string): string {
  return JSON.stringify({
    version: PAYLOAD_VERSION,
    secret,
    checksum: createChecksum(secret),
  });
}

function parsePayload(payloadString: string): string {
  let payload: SecretPayload;

  try {
    payload = JSON.parse(payloadString);
  } catch {
    throw new Error('Invalid or corrupted Shamir shares');
  }

  if (
    !payload ||
    payload.version !== PAYLOAD_VERSION ||
    typeof payload.secret !== 'string' ||
    payload.checksum !== createChecksum(payload.secret)
  ) {
    throw new Error('Invalid or corrupted Shamir shares');
  }

  return payload.secret;
}

function combineRawShares(rawShares: string[]): string {
  try {
    const hex = secrets.combine(rawShares);
    return secrets.hex2str(hex);
  } catch {
    throw new Error('Invalid or corrupted Shamir shares');
  }
}

export function splitSecret(mnemonic: string, shares: number, threshold: number): string[] {
  assertNonEmptyString(mnemonic, 'Secret');
  assertValidShareConfig(shares, threshold);

  const payload = createPayload(mnemonic);
  // convert to hex
  const hex = secrets.str2hex(payload);
  // generate shares
  const parts = secrets.share(hex, shares, threshold);
  return parts.map((part) => `${SHARE_PREFIX}${part}`);
}

export function combineShares(sharesArr: string[]): string {
  if (!Array.isArray(sharesArr)) {
    throw new Error('Shares must be an array');
  }

  if (sharesArr.length === 0) {
    throw new Error('Shares must be a non-empty array');
  }

  if (sharesArr.length < 2) {
    throw new Error('At least two shares are required to reconstruct a secret');
  }

  sharesArr.forEach((share, index) => {
    assertNonEmptyString(share, `Share at index ${index}`);
  });

  const prefixedCount = sharesArr.filter((share) => share.startsWith(SHARE_PREFIX)).length;

  if (prefixedCount > 0 && prefixedCount !== sharesArr.length) {
    throw new Error('Invalid or corrupted Shamir shares');
  }

  if (prefixedCount === 0) {
    // Backward compatibility: shares generated before the v1 authenticated payload
    // wrapper did not include a prefix/checksum. Continue to restore those backups.
    return combineRawShares(sharesArr);
  }

  const payloadString = combineRawShares(
    sharesArr.map((share) => share.slice(SHARE_PREFIX.length)),
  );

  return parsePayload(payloadString);
}

export default { splitSecret, combineShares };
