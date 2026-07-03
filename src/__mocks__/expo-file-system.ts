export const documentDirectory = '/mock/documents/';
export const cacheDirectory = '/mock/cache/';
export const EncodingType = { UTF8: 'utf8', Base64: 'base64' };
export const writeAsStringAsync = jest.fn().mockResolvedValue(undefined);
export const downloadAsync = jest
  .fn()
  .mockImplementation((_uri: string, fileUri: string) =>
    Promise.resolve({ uri: fileUri, status: 200, headers: {} }),
  );
export const readAsStringAsync = jest.fn().mockResolvedValue('');
export const deleteAsync = jest.fn().mockResolvedValue(undefined);
export const getInfoAsync = jest
  .fn()
  .mockResolvedValue({ exists: true, isDirectory: false, size: 100 });
