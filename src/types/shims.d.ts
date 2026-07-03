export {};

declare module 'expo-file-system' {
  export const cacheDirectory: string | null;
  export const documentDirectory: string | null;

  export enum EncodingType {
    UTF8 = 'utf8',
    Base64 = 'base64',
  }

  export function writeAsStringAsync(
    fileUri: string,
    contents: string,
    options?: { encoding?: EncodingType },
  ): Promise<void>;

  export function downloadAsync(
    uri: string,
    fileUri: string,
    options?: { headers?: Record<string, string> },
  ): Promise<{ uri: string; status: number; headers: Record<string, string> }>;
}

interface RTCPeerConnection {
  ontrack: ((event: RTCTrackEvent) => void) | null;
  onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null;
  onconnectionstatechange: (() => void) | null;
}

interface MediaStreamTrack {
  onended: (() => void) | null;
}

declare namespace PDFKit {
  interface PDFDocument {
    page: { width: number; height: number };
    y: number;
    fontSize(size: number): PDFDocument;
    text(text: string, x?: number, y?: number, options?: Record<string, unknown>): PDFDocument;
    moveDown(lines?: number): PDFDocument;
    save(): PDFDocument;
    restore(): PDFDocument;
    end(): void;
    on(event: string, callback: (...args: unknown[]) => void): PDFDocument;
  }
}
