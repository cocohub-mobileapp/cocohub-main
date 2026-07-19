import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from'react-native-webrtc';

const configuration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const pc = new RTCPeerConnection(configuration);

export const createPeerConnection = () => {
  return pc;
};

export const createOffer = async (setLocalDescription: (desc: RTCSessionDescription) => void) => {
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  setLocalDescription(offer);
};

export const handleAnswer = async (answer: RTCSessionDescription) => {
  await pc.setRemoteDescription(answer);
};

export const addIceCandidate = async (candidate: RTCIceCandidate) => {
  await pc.addIceCandidate(candidate);
};

export const onIceCandidate = (callback: (candidate: RTCIceCandidate) => void) => {
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      callback(event.candidate);
    }
  };
};

export const addStream = (stream: MediaStream) => {
  stream.getTracks().forEach((track) => {
    pc.addTrack(track, stream);
  });
};

export const onAddStream = (callback: (stream: MediaStream) => void) => {
  pc.ontrack = (event) => {
    callback(event.streams[0]);
  };
};