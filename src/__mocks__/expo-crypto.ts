export const CryptoDigestAlgorithm = {
  SHA1: 'SHA-1',
  SHA256: 'SHA-256',
  SHA384: 'SHA-384',
  SHA512: 'SHA-512',
  MD5: 'MD5',
};

export const CryptoEncoding = {
  HEX: 'hex',
  BASE64: 'base64',
};

export const digestStringAsync = jest.fn().mockResolvedValue('mocked_hash_digest');
export const getRandomBytesAsync = jest.fn().mockResolvedValue(new Uint8Array(32));
export const randomUUID = jest.fn().mockReturnValue('123e4567-e89b-12d3-a456-426614174000');
