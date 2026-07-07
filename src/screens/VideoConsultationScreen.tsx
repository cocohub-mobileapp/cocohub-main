/**
 * VideoConsultationScreen
 *
 * In-app telemedicine video consultation between a pet owner and a vet.
 *
 * Features:
 *  - WebRTC peer-to-peer video via react-native-webrtc
 *  - Socket.IO signaling via the /signaling endpoint
 *  - Waiting room with estimated wait time
 *  - Screen sharing (show medical documents to the vet)
 *  - Recording consent dialog — recording only starts after both parties consent
 *  - Adaptive bitrate indicator (network quality badge)
 *  - Graceful handling of poor network conditions
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  type MediaStream,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCView,
  mediaDevices,
} from 'react-native-webrtc';
import { io, type Socket } from 'socket.io-client';

import config from '../config';
import apiClient from '../services/apiClient';
import { logError } from '../utils/errorLogger';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  consultationId: string;
  roomToken: string;
  userId: string;
  userRole: 'owner' | 'vet';
  petName: string;
  onEnd: () => void;
}

type NetworkQuality = 'excellent' | 'good' | 'poor' | 'critical';
type CallState = 'idle' | 'connecting' | 'waiting_room' | 'in_call' | 'screen_sharing' | 'ended';

interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

interface NetworkStats {
  packetLossPct: number;
  rttMs: number;
  bitrateKbps: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

/** Packet-loss thresholds for each quality tier */
const QUALITY_THRESHOLDS = {
  /** ≤ 2% packet loss, ≤ 150 ms RTT → excellent */
  excellent: { maxLoss: 2, maxRtt: 150 },
  /** ≤ 10% packet loss, ≤ 400 ms RTT → good */
  good: { maxLoss: 10, maxRtt: 400 },
  /** ≤ 30% packet loss → poor */
  poor: { maxLoss: 30 },
  // > 30% → critical
};

/** How often (ms) to poll WebRTC stats */
const STATS_POLL_INTERVAL_MS = 2000;

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const VideoConsultationScreen: React.FC<Props> = ({
  consultationId,
  roomToken,
  userId,
  userRole,
  petName,
  onEnd,
}) => {
  const [callState, setCallState] = useState<CallState>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [networkQuality, setNetworkQuality] = useState<NetworkQuality>('excellent');
  const [networkStats, setNetworkStats] = useState<NetworkStats>({
    packetLossPct: 0,
    rttMs: 0,
    bitrateKbps: 0,
  });
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [showUnstableBanner, setShowUnstableBanner] = useState(false);
  const [waitPosition, setWaitPosition] = useState<number>(0);
  const [estimatedWait, setEstimatedWait] = useState<number>(0);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const qualityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const joinRequestedRef = useRef(false);
  /** Accumulated stats for Sentry post-call logging */
  const statsHistoryRef = useRef<NetworkStats[]>([]);

  // ---- Network quality monitoring ----------------------------------------
  const startQualityMonitor = useCallback((pc: RTCPeerConnection) => {
    let prevBytesReceived = 0;
    let prevTimestamp = Date.now();

    qualityTimerRef.current = setInterval(() => {
      void pc.getStats().then((stats) => {
        let packetLoss = 0;
        let rttMs = 0;
        let bitrateKbps = 0;

        stats.forEach((report) => {
          const r = report as Record<string, unknown>;

          // Inbound RTP — packet loss
          if (r.type === 'inbound-rtp' && r.kind === 'video') {
            const lost = Number(r.packetsLost ?? 0);
            const received = Number(r.packetsReceived ?? 1);
            packetLoss = Math.min(100, (lost / (lost + received)) * 100);

            // Bitrate from bytes received delta
            const now = Date.now();
            const bytes = Number(r.bytesReceived ?? 0);
            const dtMs = now - prevTimestamp;
            if (dtMs > 0) {
              bitrateKbps = ((bytes - prevBytesReceived) * 8) / dtMs;
            }
            prevBytesReceived = bytes;
            prevTimestamp = now;
          }

          // Candidate pair — RTT
          if (r.type === 'candidate-pair' && r.state === 'succeeded') {
            const rtt = Number(r.currentRoundTripTime ?? 0);
            rttMs = rtt * 1000;
          }
        });

        const stats: NetworkStats = {
          packetLossPct: Math.round(packetLoss * 10) / 10,
          rttMs: Math.round(rttMs),
          bitrateKbps: Math.round(bitrateKbps),
        };
        setNetworkStats(stats);
        statsHistoryRef.current.push(stats);

        // Derive quality tier
        let quality: NetworkQuality;
        if (packetLoss > 30) {
          quality = 'critical';
        } else if (packetLoss > 10) {
          quality = 'poor';
        } else if (packetLoss > 2 || rttMs > 400) {
          quality = 'good';
        } else {
          quality = 'excellent';
        }
        setNetworkQuality(quality);

        // Auto-reduce video resolution on poor connection
        if (quality === 'poor') {
          const sender = pc.getSenders?.().find((s) => s.track?.kind === 'video');
          if (sender) {
            const params = sender.getParameters();
            if (params.encodings?.[0]) {
              params.encodings[0].maxBitrate = 200_000; // 200 kbps
              void sender.setParameters(params);
            }
          }
          setShowUnstableBanner(false);
        }

        // Critical: show 'Switch to audio only' banner
        if (quality === 'critical') {
          setShowUnstableBanner(true);
        } else {
          setShowUnstableBanner(false);
        }
      });
    }, STATS_POLL_INTERVAL_MS);
  }, []);

  // ---- Start local media -------------------------------------------------
  const startLocalMedia = useCallback(async () => {
    try {
      const stream = await mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      return stream;
    } catch (err) {
      logError(err instanceof Error ? err : new Error(String(err)), {
        screen: 'VideoConsultationScreen',
        action: 'startLocalMedia',
      });
      Alert.alert(
        'Camera / Microphone',
        'Please grant camera and microphone permissions to join the consultation.',
      );
      return null;
    }
  }, []);

  // ---- Build RTCPeerConnection -------------------------------------------
  const buildPeerConnection = useCallback(
    (iceServers: IceServer[], stream: MediaStream): RTCPeerConnection => {
      const pc = new RTCPeerConnection({ iceServers }) as RTCPeerConnection & {
        ontrack: ((event: RTCTrackEvent) => void) | null;
        onicecandidate: ((event: RTCPeerConnectionIceEvent) => void) | null;
        onconnectionstatechange: (() => void) | null;
      };

      // Add local tracks
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Remote stream
      pc.ontrack = (event) => {
        setRemoteStream((event.streams[0] ?? null) as any);
      };

      // ICE candidate relay
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('ice_candidate', {
            consultationId,
            candidate: event.candidate,
          });
        }
      };

      // Connection state changes
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setCallState('in_call');
          startQualityMonitor(pc);
        } else if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
          setNetworkQuality('poor');
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [consultationId, startQualityMonitor],
  );

  // ---- Prepare local media after signaling admission ----------------------
  const preparePeerConnection = useCallback(
    async (iceServers: IceServer[]) => {
      if (pcRef.current) return;

      const stream = await startLocalMedia();
      if (!stream) return;

      const socket = socketRef.current!;
      const pc = buildPeerConnection(iceServers, stream);

      // ---- Signaling event handlers -------------------------------------
      socket.on('peer_joined', async ({ role }: { role: string }) => {
        // Caller (owner) creates the offer
        if (userRole === 'owner' || role === 'owner') {
          try {
            const offer = await pc.createOffer({});
            await pc.setLocalDescription(new RTCSessionDescription(offer));
            socket.emit('offer', { consultationId, sdp: offer });
          } catch (err) {
            logError(err instanceof Error ? err : new Error(String(err)), {
              screen: 'VideoConsultationScreen',
              action: 'createOffer',
            });
          }
        }
      });

      socket.on('offer', async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
        try {
          await pc.setRemoteDescription(
            new RTCSessionDescription({ type: sdp.type!, sdp: sdp.sdp ?? '' }),
          );
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(new RTCSessionDescription(answer));
          socket.emit('answer', { consultationId, sdp: answer });
        } catch (err) {
          logError(err instanceof Error ? err : new Error(String(err)), {
            screen: 'VideoConsultationScreen',
            action: 'handleOffer',
          });
        }
      });

      socket.on('answer', async ({ sdp }: { sdp: RTCSessionDescriptionInit }) => {
        try {
          await pc.setRemoteDescription(
            new RTCSessionDescription({ type: sdp.type!, sdp: sdp.sdp ?? '' }),
          );
        } catch (err) {
          logError(err instanceof Error ? err : new Error(String(err)), {
            screen: 'VideoConsultationScreen',
            action: 'handleAnswer',
          });
        }
      });

      socket.on('ice_candidate', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch {
          // Non-fatal — ICE may arrive out of order
        }
      });

      socket.on('peer_left', () => {
        setRemoteStream(null);
        setCallState('ended');
        void endCall();
      });

      socket.on('screen_toggle', ({ enabled }: { enabled: boolean }) => {
        if (!enabled) setIsSharingScreen(false);
      });

      socket.on('error', ({ message }: { message: string }) => {
        Alert.alert('Connection Error', message);
        onEnd();
      });
    },
    [consultationId, userRole, startLocalMedia, buildPeerConnection, onEnd],
  );

  const requestJoinRoom = useCallback(() => {
    const socket = socketRef.current;
    if (!socket || joinRequestedRef.current) return;

    joinRequestedRef.current = true;
    socket.emit('join_room', { consultationId, roomToken, userId, role: userRole });
  }, [consultationId, roomToken, userId, userRole]);

  // ---- Initialise --------------------------------------------------------
  useEffect(() => {
    setCallState('connecting');

    const socket = io(config.api.baseUrl.replace('/api', ''), {
      path: '/signaling',
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on(
      'joined',
      (data: { iceServers: IceServer[]; position?: number; estimatedWaitMinutes?: number }) => {
        void preparePeerConnection(data.iceServers);
        if (data.position != null) {
          setCallState('waiting_room');
          setWaitPosition(data.position);
          setEstimatedWait(data.estimatedWaitMinutes ?? 0);
        } else {
          setCallState('connecting');
        }
      },
    );

    // Show consent dialog before joining (recording opt-in)
    setShowConsentModal(true);

    return () => {
      socket.disconnect();
      if (qualityTimerRef.current) clearInterval(qualityTimerRef.current);
    };
  }, [preparePeerConnection]);

  // ---- Controls ----------------------------------------------------------
  const toggleMute = useCallback(() => {
    localStream?.getAudioTracks().forEach((t) => {
      t.enabled = isMuted;
    });
    setIsMuted((prev) => !prev);
  }, [localStream, isMuted]);

  const toggleCamera = useCallback(() => {
    localStream?.getVideoTracks().forEach((t) => {
      t.enabled = isCameraOff;
    });
    setIsCameraOff((prev) => !prev);
  }, [localStream, isCameraOff]);

  const toggleScreenShare = useCallback(async () => {
    if (!socketRef.current) return;

    if (!isSharingScreen) {
      try {
        const screenStream = await (mediaDevices as any).getDisplayMedia({ video: true });
        const screenTrack = screenStream.getVideoTracks()[0];
        const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');

        if (sender && screenTrack) {
          await sender.replaceTrack(screenTrack);
          setIsSharingScreen(true);
          socketRef.current.emit('toggle_screen', { consultationId, enabled: true });

          screenTrack.onended = () => {
            void toggleScreenShare();
          };
        }
      } catch (err) {
        logError(err instanceof Error ? err : new Error(String(err)), {
          screen: 'VideoConsultationScreen',
          action: 'startScreenShare',
        });
        Alert.alert('Screen Sharing', 'Could not start screen sharing.');
      }
    } else {
      // Restore camera track
      const cameraStream = await mediaDevices.getUserMedia({ video: true });
      const cameraTrack = cameraStream.getVideoTracks()[0];
      const sender = pcRef.current?.getSenders().find((s) => s.track?.kind === 'video');

      if (sender && cameraTrack) {
        await sender.replaceTrack(cameraTrack);
      }
      setIsSharingScreen(false);
      socketRef.current.emit('toggle_screen', { consultationId, enabled: false });
    }
  }, [consultationId, isSharingScreen]);

  const switchToAudioOnly = useCallback(async () => {
    // Disable video track
    localStream?.getVideoTracks().forEach((t) => {
      t.enabled = false;
    });
    setIsCameraOff(true);
    setIsAudioOnly(true);
    setShowUnstableBanner(false);
  }, [localStream]);

  const endCall = useCallback(async () => {
    if (qualityTimerRef.current) clearInterval(qualityTimerRef.current);

    // Log post-call stats to Sentry
    if (statsHistoryRef.current.length > 0) {
      const avgLoss =
        statsHistoryRef.current.reduce((s, r) => s + r.packetLossPct, 0) /
        statsHistoryRef.current.length;
      const avgRtt =
        statsHistoryRef.current.reduce((s, r) => s + r.rttMs, 0) / statsHistoryRef.current.length;
      logError(new Error('WebRTC post-call stats'), {
        consultationId,
        avgPacketLossPct: Math.round(avgLoss * 10) / 10,
        avgRttMs: Math.round(avgRtt),
        samples: statsHistoryRef.current.length,
        finalQuality: networkQuality,
      });
    }

    pcRef.current?.close();
    localStream?.getTracks().forEach((t) => t.stop());

    socketRef.current?.emit('leave_room', { consultationId });
    socketRef.current?.disconnect();

    setCallState('ended');
    onEnd();
  }, [consultationId, localStream, networkQuality, onEnd]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  // Recording consent modal
  if (showConsentModal) {
    return (
      <Modal transparent animationType="slide" visible>
        <View style={styles.consentOverlay}>
          <View style={styles.consentCard}>
            <Text style={styles.consentTitle}>Session Recording Consent</Text>
            <Text style={styles.consentBody}>
              This telemedicine consultation may be recorded for your medical records. Both the pet
              owner and the vet must consent before recording begins.{'\n\n'}
              You can change your preference during the call.
            </Text>
            <View style={styles.consentButtons}>
              <TouchableOpacity
                style={[styles.consentBtn, styles.consentBtnDecline]}
                onPress={() => {
                  setConsentGiven(false);
                  setShowConsentModal(false);
                  requestJoinRoom();
                }}
              >
                <Text style={styles.consentBtnTextDecline}>No Recording</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.consentBtn, styles.consentBtnAccept]}
                onPress={() => {
                  setConsentGiven(true);
                  setShowConsentModal(false);
                  // Notify backend of consent
                  void apiClient
                    .post(`/consultations/${consultationId}/consent`)
                    .catch(() => null)
                    .finally(requestJoinRoom);
                }}
              >
                <Text style={styles.consentBtnTextAccept}>I Consent</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // Waiting room
  if (callState === 'waiting_room') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.waitTitle}>Waiting Room</Text>
        <Text style={styles.waitBody}>
          Consultation for <Text style={styles.bold}>{petName}</Text>
        </Text>
        <Text style={styles.waitPosition}>Your position: #{waitPosition}</Text>
        {estimatedWait > 0 && (
          <Text style={styles.waitEst}>Estimated wait: ~{estimatedWait} min</Text>
        )}
        <TouchableOpacity style={styles.leaveBtn} onPress={() => void endCall()}>
          <Text style={styles.leaveBtnText}>Leave Queue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Connecting
  if (callState === 'connecting' || callState === 'idle') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#4A90E2" />
        <Text style={styles.connectingText}>Connecting to consultation…</Text>
      </View>
    );
  }

  // Ended
  if (callState === 'ended') {
    return (
      <View style={styles.centered}>
        <Text style={styles.endedTitle}>Consultation Ended</Text>
        {consentGiven && (
          <Text style={styles.endedSub}>Your session recording has been saved securely.</Text>
        )}
        <TouchableOpacity style={styles.doneBtn} onPress={onEnd}>
          <Text style={styles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Active call
  return (
    <View style={styles.callContainer}>
      {/* Remote video (full screen) */}
      {remoteStream ? (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.remoteVideo}
          objectFit="cover"
          mirror={false}
        />
      ) : (
        <View style={[styles.remoteVideo, styles.noRemote]}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.waitingForPeer}>Waiting for the other participant…</Text>
        </View>
      )}

      {/* Local video (picture-in-picture) */}
      {localStream && !isCameraOff && (
        <RTCView
          streamURL={localStream.toURL()}
          style={styles.localVideo}
          objectFit="cover"
          mirror
        />
      )}

      {/* 4-bar network quality indicator */}
      {(() => {
        const bars =
          networkQuality === 'excellent'
            ? 4
            : networkQuality === 'good'
              ? 3
              : networkQuality === 'poor'
                ? 2
                : 1;
        const barColor =
          networkQuality === 'excellent'
            ? '#4caf50'
            : networkQuality === 'good'
              ? '#8bc34a'
              : networkQuality === 'poor'
                ? '#ff9800'
                : '#f44336';
        const label = networkQuality.charAt(0).toUpperCase() + networkQuality.slice(1);
        return (
          <View style={styles.qualityBadge}>
            <View style={styles.signalBars}>
              {[1, 2, 3, 4].map((n) => (
                <View
                  key={n}
                  style={[
                    styles.signalBar,
                    { height: 6 + n * 3 },
                    { backgroundColor: n <= bars ? barColor : 'rgba(255,255,255,0.25)' },
                  ]}
                />
              ))}
            </View>
            <Text style={styles.qualityText}>{label}</Text>
          </View>
        );
      })()}

      {/* Screen sharing indicator */}
      {isSharingScreen && (
        <View style={styles.sharingBadge}>
          <Text style={styles.sharingText}>Sharing Screen</Text>
        </View>
      )}

      {/* Unstable connection banner */}
      {showUnstableBanner && (
        <View style={styles.unstableBanner}>
          <Text style={styles.unstableBannerText}>🚨 Connection unstable</Text>
          <TouchableOpacity style={styles.audioOnlyBtn} onPress={() => void switchToAudioOnly()}>
            <Text style={styles.audioOnlyBtnText}>Switch to audio only</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Audio-only indicator */}
      {isAudioOnly && (
        <View style={styles.audioOnlyBadge}>
          <Text style={styles.audioOnlyBadgeText}>🎧 Audio only</Text>
        </View>
      )}

      {/* Call controls */}
      <View style={styles.controls}>
        <Pressable
          style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
          onPress={toggleMute}
          accessibilityRole="button"
          accessibilityLabel={isMuted ? 'Unmute' : 'Mute'}
        >
          <Text style={styles.controlIcon}>{isMuted ? '🔇' : '🎤'}</Text>
        </Pressable>

        <Pressable
          style={[styles.controlBtn, isCameraOff && styles.controlBtnActive]}
          onPress={toggleCamera}
          accessibilityRole="button"
          accessibilityLabel={isCameraOff ? 'Turn camera on' : 'Turn camera off'}
        >
          <Text style={styles.controlIcon}>{isCameraOff ? '📵' : '📷'}</Text>
        </Pressable>

        <Pressable
          style={[styles.controlBtn, isSharingScreen && styles.controlBtnActive]}
          onPress={() => void toggleScreenShare()}
          accessibilityRole="button"
          accessibilityLabel="Share screen"
        >
          <Text style={styles.controlIcon}>🖥</Text>
        </Pressable>

        <Pressable
          style={[styles.controlBtn, styles.endCallBtn]}
          onPress={() => void endCall()}
          accessibilityRole="button"
          accessibilityLabel="End call"
        >
          <Text style={styles.controlIcon}>📵</Text>
        </Pressable>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#111',
    gap: 12,
  },

  // Connecting
  connectingText: { color: '#fff', fontSize: 15, marginTop: 12 },

  // Waiting room
  waitTitle: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 16 },
  waitBody: { color: '#ccc', fontSize: 15 },
  bold: { fontWeight: '700', color: '#fff' },
  waitPosition: { color: '#4A90E2', fontSize: 18, fontWeight: '600' },
  waitEst: { color: '#aaa', fontSize: 14 },
  leaveBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e53935',
  },
  leaveBtnText: { color: '#e53935', fontWeight: '600' },

  // Ended
  endedTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  endedSub: { color: '#aaa', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  doneBtn: {
    marginTop: 20,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#4A90E2',
  },
  doneBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },

  // Active call
  callContainer: { flex: 1, backgroundColor: '#000' },
  remoteVideo: { flex: 1 },
  noRemote: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a1a' },
  waitingForPeer: { color: '#888', marginTop: 12 },
  localVideo: {
    position: 'absolute',
    right: 16,
    top: 56,
    width: 100,
    height: 140,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  // Quality badge (contains signal bars + label)
  qualityBadge: {
    position: 'absolute',
    top: 56,
    left: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  signalBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  signalBar: {
    width: 4,
    borderRadius: 2,
  },
  qualityText: { color: '#fff', fontSize: 11, fontWeight: '600', marginLeft: 4 },
  sharingBadge: {
    position: 'absolute',
    top: 100,
    left: 16,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(74,144,226,0.85)',
  },
  sharingText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  // Unstable connection banner
  unstableBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(229,57,53,0.92)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  unstableBannerText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  audioOnlyBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  audioOnlyBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  // Audio-only indicator
  audioOnlyBadge: {
    position: 'absolute',
    top: 46,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  audioOnlyBadgeText: { color: '#fff', fontWeight: '600', fontSize: 13 },

  // Controls bar
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnActive: { backgroundColor: 'rgba(229,57,53,0.5)' },
  endCallBtn: { backgroundColor: '#e53935' },
  controlIcon: { fontSize: 22 },

  // Consent modal
  consentOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  consentCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  consentTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a', marginBottom: 12 },
  consentBody: { fontSize: 14, color: '#444', lineHeight: 22, marginBottom: 24 },
  consentButtons: { flexDirection: 'row', gap: 12 },
  consentBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  consentBtnDecline: { borderWidth: 1, borderColor: '#ccc' },
  consentBtnAccept: { backgroundColor: '#4A90E2' },
  consentBtnTextDecline: { color: '#555', fontWeight: '600' },
  consentBtnTextAccept: { color: '#fff', fontWeight: '600' },
});

export default VideoConsultationScreen;
