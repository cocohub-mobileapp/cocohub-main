export const documentDirectory = '/mock/documents/';
export const cacheDirectory = '/mock/cache/';
export const EncodingType = { UTF8: 'utf8', Base64: 'base64' };
export const writeAsStringAsync = jest.fn().mockResolvedValue(undefined);
export const readAsStringAsync = jest.fn().mockResolvedValue('');
export const deleteAsync = jest.fn().mockResolvedValue(undefined);
export const getInfoAsync = jest
  .fn()
  .mockResolvedValue({ exists: true, isDirectory: false, size: 100 });
export const downloadAsync = jest
  .fn()
  .mockResolvedValue({ uri: '/mock/cache/report.pdf', status: 200 });
