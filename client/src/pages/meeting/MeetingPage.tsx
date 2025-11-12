import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { useMediaContext } from '../../contexts/MediaContext';
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

  // Media context - provides all media-related state and actions
  const {
    localStream,
    isAudioEnabled,
    isVideoEnabled,
    isSpeaking,
    remotePeers,
    initializeMedia,
    toggleAudio,
    toggleVideo,
    cleanup: cleanupMedia
  } = useMediaContext();

  // Sockets hook - handles all WebRTC and socket.io logic
  const {
    initializeSocket,
    disconnect,
    addLocalTracksToAllPeers
  } = useSockets({
    roomId: normalizedRoomId,
    userName
  });

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const tracksAddedRef = useRef(false);

  // Attach the hook-provided localStream to the local preview element
  useEffect(() => {
    if (localVideoRef.current) {
      (localVideoRef.current as HTMLVideoElement).srcObject = localStream || null;
    }
  }, [localStream]);

  // When local stream becomes available, add it to all existing peer connections
  useEffect(() => {
    if (localStream && !tracksAddedRef.current) {
      console.log('Local stream available, adding tracks to all peers');
      addLocalTracksToAllPeers();
      tracksAddedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, normalizedRoomId]);

  const handleLeave = () => {
    cleanup();
    sessionStorage.removeItem('userName');
    navigate('/');
  };

  const cleanup = () => {
    // Cleanup media (stops local stream, closes audio contexts)
    cleanupMedia();

    // Disconnect socket and close all peer connections
    disconnect();
  };

  return (
    <div className="meeting-page">
      {remotePeers.size === 0 ? (
        <NoPeersPlaceholder
          roomId={roomId || ''}
          normalizedRoomId={normalizedRoomId}
        />
      ) : (
        <div className="meeting-page__grid">
          {Array.from(remotePeers.values()).map((peer) => (
            <div key={peer.id} className="meeting-page__grid-item">
              <RemoteVideo
                stream={peer.stream}
                displayName={peer.displayName}
                isSpeaking={peer.isSpeaking}
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
