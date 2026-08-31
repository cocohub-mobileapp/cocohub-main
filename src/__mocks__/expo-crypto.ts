export const digestStringAsync = jest.fn().mockResolvedValue('abc123');
export const getRandomBytesAsync = jest.fn().mockResolvedValue(new Uint8Array(32));
export const randomUUID = jest.fn().mockReturnValue('mock-uuid-1234');
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
