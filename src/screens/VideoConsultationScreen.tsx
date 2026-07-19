import React, { useState, useEffect } from 'react';
import { View, Text, Button, StyleSheet } from'react-native';
import { createPeerConnection, createOffer, handleAnswer, addIceCandidate, onIceCandidate, addStream, onAddStream } from '../services/webrtcService';
import { getUserMedia } from '../utils/mediaUtils';

const VideoConsultationScreen = () => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);

  useEffect(() => {
    const setupWebRTC = async () => {
      const stream = await getUserMedia();
      setLocalStream(stream);

      const pc = createPeerConnection();
      setPeerConnection(pc);

      addStream(stream);
      onAddStream(setRemoteStream);

      onIceCandidate((candidate) => {
        // Send ICE candidate to the other peer
      });

      createOffer((offer) => {
        // Send offer to the other peer
      });
    };

    setupWebRTC();

    return () => {
      if (peerConnection) {
        peerConnection.close();
      }
    };
  }, []);

  const handleIncomingAnswer = (answer: RTCSessionDescription) => {
    handleAnswer(answer);
  };

  const handleIncomingIceCandidate = (candidate: RTCIceCandidate) => {
    addIceCandidate(candidate);
  };

  return (
    <View style={styles.container}>
      <Text>Video Consultation</Text>
      {localStream && <View style={styles.videoContainer}>{/* Render local video */}</View>}
      {remoteStream && <View style={styles.videoContainer}>{/* Render remote video */}</View>}
      <Button title="End Call" onPress={() => {}} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    width: 300,
    height: 300,
    backgroundColor: 'black',
  },
});

export default VideoConsultationScreen;