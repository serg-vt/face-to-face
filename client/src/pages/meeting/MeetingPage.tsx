import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import useMedia from '../../hooks/useMedia';
import useSockets from '../../hooks/useSockets';

import Controls from "../../components/controls";
import RemoteVideo from "../../components/remoteVideo";
import LocalVideo from "../../components/localVideo";

import './MeetingPage.scss';
import NoPeersPlaceholder from "../../components/noPeersPlaceholder";


const MeetingPage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  // Normalize roomId to lowercase for consistency (URLs may be uppercase)
  const normalizedRoomId = roomId ? roomId.toLowerCase() : '';
  const userName = sessionStorage.getItem('userName') || 'Guest';

  // Media hook - only pull what's needed here
  const {
    localStream,
    localStreamRef,
    isAudioEnabled,
    isVideoEnabled,
    isSpeaking,
    initializeMedia,
    toggleAudio,
    toggleVideo
  } = useMedia();

  // Sockets hook - handles all WebRTC and socket.io logic
  const {
    peers,
    initializeSocket,
    disconnect
  } = useSockets({
    roomId: normalizedRoomId,
    userName,
    localStreamRef
  });

  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Attach the hook-provided localStream to the local preview element
  useEffect(() => {
    if (localVideoRef.current) {
      (localVideoRef.current as HTMLVideoElement).srcObject = localStream || null;
    }
  }, [localStream]);

  useEffect(() => {
    // Redirect if no roomId
    if (!roomId) {
      navigate('/');
      return;
    }

    // If the provided roomId isn't already lowercase, navigate to the canonical lowercase URL
    if (roomId && roomId !== normalizedRoomId) {
      navigate(`/meeting/${normalizedRoomId}`, { replace: true });
      return;
    }

    // Initialize media in background and start socket immediately so user can join
    const init = () => {
      // Start media acquisition but don't block socket initialization
      initializeMedia().catch((err) => console.warn('initializeMedia failed:', err));
      // Initialize socket immediately so user can join even without media
      initializeSocket();
    };

    init();

    return () => {
      // Cleanup
      cleanup();
    };
  }, [roomId, navigate, normalizedRoomId, initializeMedia, initializeSocket]);

  const handleLeave = () => {
    cleanup();
    sessionStorage.removeItem('userName');
    navigate('/');
  };

  const cleanup = () => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    localStreamRef.current = null;

    // Disconnect socket and close all peer connections
    disconnect();
  };

  return (
    <div className="meeting-page">
      {peers.size === 0 ? (
        <NoPeersPlaceholder
          roomId={roomId || ''}
          normalizedRoomId={normalizedRoomId}
        />
      ) : (
        <div className="meeting-page__grid">
          {Array.from(peers.entries()).map(([userId, peerConnection]) => (
            <div key={userId} className="meeting-page__grid-item">
              <RemoteVideo
                stream={peerConnection.stream}
                displayName={peerConnection.displayName}
              />
            </div>
          ))}
        </div>
      )}

      <LocalVideo
        localVideoRef={localVideoRef}
        userName={userName}
        isSpeaking={isSpeaking}
      />

      <Controls
        isAudioEnabled={isAudioEnabled}
        isVideoEnabled={isVideoEnabled}
        localStream={localStream}
        toggleAudio={toggleAudio}
        toggleVideo={toggleVideo}
        handleLeave={handleLeave}
      />
    </div>
  );
}

export default MeetingPage;
