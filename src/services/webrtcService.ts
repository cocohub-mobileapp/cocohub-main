/**
 * webrtcService — abstraction layer for WebRTC peer connection lifecycle.
 *
 * Wraps react-native-webrtc in a testable, framework-agnostic service so
 * VideoConsultationScreen (and future callers) can obtain streams, create
 * offers/answers, manage ICE candidates, and tear down connections without
 * importing the WebRTC library directly.
 */

import {
  type MediaStream,
  RTCIceCandidate,
  type RTCPeerConnection,
  RTCSessionDescription,
  mediaDevices,
} from 'react-native-webrtc';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export interface SignalingMessage {
  type: 'offer' | 'answer' | 'ice-candidate' | 'bye';
  payload: unknown;
  from: string;
  to: string;
}

export type SignalingSender = (msg: SignalingMessage) => void;

export interface CallOptions {
  consultationId: string;
  userId: string;
  userRole: 'OWNER' | 'VET';
  iceServers?: IceServer[];
  sendSignaling: SignalingSender;
  onRemoteStream?: (stream: MediaStream) => void;
  onIceCandidate?: (candidate: RTCIceCandidate) => void;
  onConnectionStateChange?: (state: RTCPeerConnectionState) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_ICE_SERVERS: IceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

// ─── WebRTC Service ──────────────────────────────────────────────────────────

export class WebRTCService {
  private pc: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private options: CallOptions | null = null;

  /** Creates a RTCPeerConnection and binds event listeners. */
  async init(options: CallOptions): Promise<void> {
    this.options = options;
    const iceServers = options.iceServers?.length ? options.iceServers : DEFAULT_ICE_SERVERS;

    this.pc = new RTCPeerConnection({ iceServers });

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate && options.onIceCandidate) {
        options.onIceCandidate(candidate);
      }
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc && options.onConnectionStateChange) {
        options.onConnectionStateChange(this.pc.connectionState);
      }
    };

    this.pc.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      if (this.remoteStream && options.onRemoteStream) {
        options.onRemoteStream(this.remoteStream);
      }
    };
  }

  /** Acquires the local camera/microphone stream and adds tracks to the peer connection. */
  async getLocalStream(videoEnabled = true, audioEnabled = true): Promise<MediaStream> {
    if (!this.pc) throw new Error('Call init() before getLocalStream()');

    const constraints: MediaStreamConstraints = {
      audio: audioEnabled,
      video: videoEnabled
        ? { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
        : false,
    };

    this.localStream = await mediaDevices.getUserMedia(constraints);

    for (const track of this.localStream.getTracks()) {
      this.pc.addTrack(track, this.localStream);
    }

    return this.localStream;
  }

  /** Creates an SDP offer, sets it as the local description, and sends it via signaling. */
  async createOffer(): Promise<RTCSessionDescription> {
    if (!this.pc || !this.options) throw new Error('Not initialized');

    const offer = await this.pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });
    await this.pc.setLocalDescription(offer);

    this.options.sendSignaling({
      type: 'offer',
      payload: { sdp: offer.sdp, type: offer.type },
      from: this.options.userId,
      to: '',
    });

    return offer;
  }

  /** Receives an SDP offer from the remote peer, creates an answer, and sends it back. */
  async handleOffer(sdp: string): Promise<RTCSessionDescription> {
    if (!this.pc || !this.options) throw new Error('Not initialized');

    const offer = new RTCSessionDescription({ type: 'offer', sdp });
    await this.pc.setRemoteDescription(offer);

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    this.options.sendSignaling({
      type: 'answer',
      payload: { sdp: answer.sdp, type: answer.type },
      from: this.options.userId,
      to: '',
    });

    return answer;
  }

  /** Receives an SDP answer from the remote peer and sets it as the remote description. */
  async handleAnswer(sdp: string): Promise<void> {
    if (!this.pc) throw new Error('Not initialized');

    const answer = new RTCSessionDescription({ type: 'answer', sdp });
    await this.pc.setRemoteDescription(answer);
  }

  /** Adds a remote ICE candidate. */
  async handleIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.pc) throw new Error('Not initialized');

    await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  /** Toggles the local video track on/off. */
  toggleVideo(enabled: boolean): void {
    if (!this.localStream) return;
    for (const track of this.localStream.getVideoTracks()) {
      track.enabled = enabled;
    }
  }

  /** Toggles the local audio track on/off (mute). */
  toggleAudio(enabled: boolean): void {
    if (!this.localStream) return;
    for (const track of this.localStream.getAudioTracks()) {
      track.enabled = enabled;
    }
  }

  /** Replaces the local video track with a new screen-sharing stream. */
  async switchToScreenShare(stream: MediaStream): Promise<void> {
    if (!this.pc || !this.localStream) throw new Error('Not initialized');

    const screenTrack = stream.getVideoTracks()[0];
    if (!screenTrack) return;

    const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
    if (sender) {
      await sender.replaceTrack(screenTrack);
    }
  }

  /** Switches back from screen share to the camera stream. */
  async switchToCamera(): Promise<void> {
    if (!this.pc || !this.localStream) throw new Error('Not initialized');

    const cameraTrack = this.localStream.getVideoTracks()[0];
    if (!cameraTrack) return;

    const sender = this.pc.getSenders().find((s) => s.track?.kind === 'video');
    if (sender) {
      await sender.replaceTrack(cameraTrack);
    }
  }

  /** Returns the local MediaStream. */
  getLocalMediaStream(): MediaStream | null {
    return this.localStream;
  }

  /** Returns the remote MediaStream. */
  getRemoteMediaStream(): MediaStream | null {
    return this.remoteStream;
  }

  /** Tears down the peer connection and releases all media tracks. */
  async close(): Promise<void> {
    if (this.options) {
      this.options.sendSignaling({
        type: 'bye',
        payload: {},
        from: this.options.userId,
        to: '',
      });
    }

    if (this.localStream) {
      for (const track of this.localStream.getTracks()) {
        track.stop();
      }
      this.localStream = null;
    }

    if (this.pc) {
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.ontrack = null;
      this.pc.close();
      this.pc = null;
    }

    this.remoteStream = null;
    this.options = null;
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

export function createWebRTCService(): WebRTCService {
  return new WebRTCService();
}

// ─── Helper: parse incoming signaling messages ────────────────────────────────

export function parseSignalingMessage(raw: unknown): SignalingMessage | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const type = record.type;
  if (type !== 'offer' && type !== 'answer' && type !== 'ice-candidate' && type !== 'bye') {
    return null;
  }
  if (typeof record.from !== 'string' || typeof record.to !== 'string') return null;
  return { type, payload: record.payload, from: record.from, to: record.to };
}
