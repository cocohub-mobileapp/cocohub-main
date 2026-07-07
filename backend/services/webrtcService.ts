/**
 * WebRTC signaling service — backend
 *
 * Manages telemedicine consultation rooms, WebRTC signaling via Socket.IO,
 * waiting room queuing, session recording consent, and adaptive bitrate hints.
 *
 * Architecture:
 *   - REST layer  (/api/consultations) creates and queries consultations
 *   - Socket.IO   (/signaling namespace) handles real-time offer/answer/ICE
 *
 * Environment variables:
 *   STUN_URLS             — Comma-separated STUN server URLs
 *   TURN_URL              — TURN server URL
 *   TURN_USERNAME         — TURN credential username
 *   TURN_CREDENTIAL       — TURN credential password
 *   RECORDING_STORAGE_URL — Base URL for storing encrypted session recordings
 *   MAX_WAITING_ROOM_SIZE — Maximum pets/owners in queue (default: 50)
 */

import crypto from 'crypto';
import type http from 'http';

import { Server as SocketIOServer, type Socket } from 'socket.io';

import { UserRole } from '../models/UserRole';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const STUN_URLS = (
  process.env.STUN_URLS ?? 'stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302'
)
  .split(',')
  .map((u) => u.trim());

const ICE_SERVERS: RTCIceServer[] = [
  { urls: STUN_URLS },
  ...(process.env.TURN_URL
    ? [
        {
          urls: process.env.TURN_URL,
          username: process.env.TURN_USERNAME ?? '',
          credential: process.env.TURN_CREDENTIAL ?? '',
        },
      ]
    : []),
];

const MAX_WAITING_ROOM_SIZE = Number(process.env.MAX_WAITING_ROOM_SIZE) || 50;

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type ConsultationStatus =
  | 'scheduled'
  | 'waiting'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface RecordingConsent {
  ownerId: string;
  vetId: string;
  ownerConsented: boolean;
  vetConsented: boolean;
  consentedAt?: string;
}

export interface Consultation {
  id: string;
  petId: string;
  ownerId: string;
  vetId: string;
  scheduledAt: string;
  durationMinutes: number;
  status: ConsultationStatus;
  waitingRoomJoinedAt?: string;
  startedAt?: string;
  endedAt?: string;
  roomToken: string;
  vetDecision?: 'accepted' | 'declined';
  vetDecisionAt?: string;
  vetDecisionReason?: string;
  recordingConsent: RecordingConsent;
  recordingUrl?: string;
  createdAt: string;
  updatedAt: string;
}

interface ConnectedParticipant {
  socketId: string;
  userId: string;
  role: string;
  consultationId: string;
  joinedAt: string;
}

interface WaitingEntry {
  consultationId: string;
  ownerId: string;
  joinedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// IN-MEMORY STORES  (replace with database in production)
// ─────────────────────────────────────────────────────────────────────────────

export const consultations = new Map<string, Consultation>();
const participants = new Map<string, ConnectedParticipant>();
const waitingRoom: WaitingEntry[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// CONSULTATION MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────

export function createConsultation(
  petId: string,
  ownerId: string,
  vetId: string,
  scheduledAt: string,
  durationMinutes = 30,
): Consultation {
  const id = crypto.randomUUID();
  const roomToken = crypto.randomBytes(32).toString('hex');
  const now = new Date().toISOString();

  const consultation: Consultation = {
    id,
    petId,
    ownerId,
    vetId,
    scheduledAt,
    durationMinutes,
    status: 'scheduled',
    roomToken,
    recordingConsent: {
      ownerId,
      vetId,
      ownerConsented: false,
      vetConsented: false,
    },
    createdAt: now,
    updatedAt: now,
  };

  consultations.set(id, consultation);
  return consultation;
}

export function getConsultationById(id: string): Consultation | undefined {
  return consultations.get(id);
}

export function listConsultationsForUser(userId: string): Consultation[] {
  return [...consultations.values()].filter((c) => c.ownerId === userId || c.vetId === userId);
}

export function joinWaitingRoom(consultationId: string, ownerId: string): number {
  if (waitingRoom.length >= MAX_WAITING_ROOM_SIZE) {
    throw new Error('Waiting room is full');
  }

  if (waitingRoom.find((e) => e.consultationId === consultationId)) {
    return waitingRoom.findIndex((e) => e.consultationId === consultationId) + 1;
  }

  waitingRoom.push({ consultationId, ownerId, joinedAt: new Date().toISOString() });
  const c = consultations.get(consultationId);
  if (c) {
    c.status = 'waiting';
    c.waitingRoomJoinedAt = new Date().toISOString();
    c.updatedAt = new Date().toISOString();
  }

  return waitingRoom.length;
}

export function leaveWaitingRoom(consultationId: string): void {
  const idx = waitingRoom.findIndex((e) => e.consultationId === consultationId);
  if (idx !== -1) waitingRoom.splice(idx, 1);
}

export function getWaitingPosition(consultationId: string): number {
  return waitingRoom.findIndex((e) => e.consultationId === consultationId) + 1;
}

/** Estimated wait time in minutes based on position and average session duration */
export function estimatedWaitMinutes(consultationId: string): number {
  const pos = getWaitingPosition(consultationId);
  if (pos <= 0) return 0;
  const avgSessionMin = 20;
  return (pos - 1) * avgSessionMin;
}

export function recordConsent(
  consultationId: string,
  userId: string,
  role: string,
): Consultation | undefined {
  const c = consultations.get(consultationId);
  if (!c) return undefined;

  if (role === UserRole.OWNER) {
    c.recordingConsent.ownerConsented = true;
  } else if (role === UserRole.VET) {
    c.recordingConsent.vetConsented = true;
  }

  if (c.recordingConsent.ownerConsented && c.recordingConsent.vetConsented) {
    c.recordingConsent.consentedAt = new Date().toISOString();
  }

  c.updatedAt = new Date().toISOString();
  return c;
}

export function recordVetDecision(
  consultationId: string,
  decision: 'accepted' | 'declined',
  reason?: string,
): Consultation | undefined {
  const c = consultations.get(consultationId);
  if (!c) return undefined;

  c.vetDecision = decision;
  c.vetDecisionAt = new Date().toISOString();
  c.vetDecisionReason = reason;
  if (decision === 'declined') {
    c.status = 'cancelled';
    c.endedAt = c.vetDecisionAt;
  }
  c.updatedAt = new Date().toISOString();
  return c;
}

export function getIceServers(): RTCIceServer[] {
  return ICE_SERVERS;
}

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET.IO SIGNALING SERVER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Attaches a Socket.IO server to an existing HTTP server and configures
 * WebRTC signaling for the /signaling namespace.
 *
 * Socket.IO events (client → server):
 *   join_room     { consultationId, roomToken, userId, role }
 *   offer         { consultationId, sdp }
 *   answer        { consultationId, sdp }
 *   ice_candidate { consultationId, candidate }
 *   toggle_screen { consultationId, enabled }
 *   leave_room    { consultationId }
 *
 * Socket.IO events (server → client):
 *   joined         { consultationId, iceServers, position?, estimatedWait? }
 *   peer_joined    { userId, role }
 *   peer_left      { userId }
 *   offer          { sdp, from }
 *   answer         { sdp, from }
 *   ice_candidate  { candidate, from }
 *   screen_toggle  { userId, enabled }
 *   error          { code, message }
 */
export function createSignalingServer(httpServer: http.Server): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    path: '/signaling',
  });

  const signalingNs = io.of('/');

  signalingNs.on('connection', (socket: Socket) => {
    // ---- join_room -------------------------------------------------------
    socket.on(
      'join_room',
      (data: { consultationId: string; roomToken: string; userId: string; role: string }) => {
        const { consultationId, roomToken, userId, role } = data;
        const c = consultations.get(consultationId);

        if (!c) {
          socket.emit('error', { code: 'NOT_FOUND', message: 'Consultation not found' });
          return;
        }

        // Validate room token to prevent unauthorised access
        if (c.roomToken !== roomToken) {
          socket.emit('error', { code: 'FORBIDDEN', message: 'Invalid room token' });
          return;
        }

        participants.set(socket.id, {
          socketId: socket.id,
          userId,
          role,
          consultationId,
          joinedAt: new Date().toISOString(),
        });

        void socket.join(consultationId);

        // Notify existing peers
        socket.to(consultationId).emit('peer_joined', { userId, role });

        const isOwner = role === UserRole.OWNER;

        // If owner is joining, put them in waiting room; vets skip the queue
        if (isOwner && c.status === 'scheduled') {
          const position = joinWaitingRoom(consultationId, userId);
          socket.emit('joined', {
            consultationId,
            iceServers: ICE_SERVERS,
            position,
            estimatedWaitMinutes: estimatedWaitMinutes(consultationId),
          });
        } else {
          // Vet joining — start the session if an owner is waiting
          if (c.status === 'waiting') {
            leaveWaitingRoom(consultationId);
            c.status = 'in_progress';
            c.startedAt = new Date().toISOString();
            c.updatedAt = new Date().toISOString();
          }
          socket.emit('joined', { consultationId, iceServers: ICE_SERVERS });
        }
      },
    );

    // ---- WebRTC signaling ------------------------------------------------
    socket.on('offer', (data: { consultationId: string; sdp: RTCSessionDescriptionInit }) => {
      const p = participants.get(socket.id);
      if (!p) return;
      socket.to(data.consultationId).emit('offer', { sdp: data.sdp, from: p.userId });
    });

    socket.on('answer', (data: { consultationId: string; sdp: RTCSessionDescriptionInit }) => {
      const p = participants.get(socket.id);
      if (!p) return;
      socket.to(data.consultationId).emit('answer', { sdp: data.sdp, from: p.userId });
    });

    socket.on(
      'ice_candidate',
      (data: { consultationId: string; candidate: RTCIceCandidateInit }) => {
        const p = participants.get(socket.id);
        if (!p) return;
        socket
          .to(data.consultationId)
          .emit('ice_candidate', { candidate: data.candidate, from: p.userId });
      },
    );

    // ---- Screen sharing --------------------------------------------------
    socket.on('toggle_screen', (data: { consultationId: string; enabled: boolean }) => {
      const p = participants.get(socket.id);
      if (!p) return;
      socket
        .to(data.consultationId)
        .emit('screen_toggle', { userId: p.userId, enabled: data.enabled });
    });

    // ---- Leave room ------------------------------------------------------
    socket.on('leave_room', (data: { consultationId: string }) => {
      handleDisconnect(socket, data.consultationId);
    });

    socket.on('disconnect', () => {
      const p = participants.get(socket.id);
      if (p) handleDisconnect(socket, p.consultationId);
    });
  });

  return io;
}

function handleDisconnect(socket: Socket, consultationId: string): void {
  const p = participants.get(socket.id);
  if (!p) return;

  participants.delete(socket.id);
  void socket.leave(consultationId);

  // Notify remaining peers
  socket.to(consultationId).emit('peer_left', { userId: p.userId });

  // End the consultation if both parties have disconnected
  const remaining = [...participants.values()].filter((q) => q.consultationId === consultationId);

  if (remaining.length === 0) {
    const c = consultations.get(consultationId);
    if (c && c.status === 'in_progress') {
      c.status = 'completed';
      c.endedAt = new Date().toISOString();
      c.updatedAt = new Date().toISOString();
      leaveWaitingRoom(consultationId);
    }
  }
}

// RTCIceServer and RTCSessionDescriptionInit are browser globals;
// declare minimal types for Node.js compilation
declare interface RTCIceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}
declare interface RTCSessionDescriptionInit {
  type: string;
  sdp?: string;
}
declare interface RTCIceCandidateInit {
  candidate?: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
}
