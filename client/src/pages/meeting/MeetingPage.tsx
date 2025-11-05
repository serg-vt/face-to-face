import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';

import useMedia from '../../hooks/useMedia';

import Controls from "../../components/controls";
import RemoteVideo from "../../components/remoteVideo";
import LocalVideo from "../../components/localVideo";

import './MeetingPage.scss';
import NoPeersPlaceholder from "../../components/noPeersPlaceholder";

interface PeerConnection {
  peer: RTCPeerConnection;
  stream?: MediaStream;
  isSpeaking?: boolean;
  addedLocalTracks?: boolean; // whether we've already added local tracks to this peer
  displayName?: string;
}

const MeetingPage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  // Normalize roomId to lowercase for consistency (URLs may be uppercase)
  const normalizedRoomId = roomId ? roomId.toLowerCase() : '';
  const userName = sessionStorage.getItem('userName') || 'Guest';
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());

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

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  };

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
      // send join with display name once socket connects (done inside initializeSocket)
    };

    init();

    return () => {
      // Cleanup
      cleanup();
    };
  }, [roomId, navigate]);

  const initializeSocket = () => {
    // In production (deployed), connect to same origin as the app
    // In development, use VITE_SERVER_URL or localhost:3000
    let serverUrl;
    if (import.meta.env.VITE_SERVER_URL) {
      serverUrl = import.meta.env.VITE_SERVER_URL;
    } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      // Development mode
      serverUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
    } else {
      // Production mode - connect to same origin
      serverUrl = window.location.origin;
    }

    console.log('Connecting to Socket.IO server:', serverUrl);
    const socket = io(serverUrl);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to server:', socket.id);
      // Send both roomId and display name
      socket.emit('join-room', { roomId: normalizedRoomId, name: userName });
    });

    // Handle existing users (array of {id,name})
    socket.on('existing-users', (users: Array<{id:string,name:string}>) => {
      console.log('Existing users in room (with names):', users);
      // For each existing user, create peer connection (we are the new joiner)
      users.forEach(u => {
        // create connection (initiator) and then store display name on the peer entry
        createPeerConnection(u.id, true);
        const pc = peersRef.current.get(u.id);
        if (pc) {
          pc.displayName = u.name || 'Participant';
          peersRef.current.set(u.id, pc);
        }
      });
      setPeers(new Map(peersRef.current));
    });

    socket.on('user-connected', (payload: { id: string; name?: string }) => {
      console.log('User connected payload:', payload);
      const { id, name } = payload;
      // Create receive-only peer entry (we will get their offer)
      createPeerConnection(id, false);
      // store name in the peer entry if available
      const pc = peersRef.current.get(id);
      if (pc) {
        pc.displayName = name || 'Participant';
        peersRef.current.set(id, pc);
        setPeers(new Map(peersRef.current));
      }
    });

    socket.on('offer', async ({ offer, from }: { offer: RTCSessionDescriptionInit; from: string }) => {
      console.log('Received offer from:', from);
      await handleOffer(offer, from);
    });

    socket.on('answer', async ({ answer, from }: { answer: RTCSessionDescriptionInit; from: string }) => {
      console.log('Received answer from:', from);
      const peerConnection = peersRef.current.get(from);
      if (peerConnection) {
        await peerConnection.peer.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socket.on('ice-candidate', async ({ candidate, from }: { candidate: RTCIceCandidateInit; from: string }) => {
      console.log('Received ICE candidate from:', from);
      const peerConnection = peersRef.current.get(from);
      if (peerConnection) {
        try {
          await peerConnection.peer.addIceCandidate(new RTCIceCandidate(candidate));
          console.log('Added ICE candidate from:', from);
        } catch (error) {
          console.error('Error adding ICE candidate:', error);
        }
      } else {
        console.warn('Received ICE candidate for unknown peer:', from);
      }
    });

    socket.on('user-disconnected', (userId: string) => {
      console.log('User disconnected:', userId);
      removePeer(userId);
    });
  };

  const createPeerConnection = (userId: string, isInitiator: boolean) => {
    const stream = localStreamRef.current;

    console.log('Creating peer connection to:', userId, 'isInitiator:', isInitiator);
    const peer = new RTCPeerConnection(iceServers);
    const peerConnection: PeerConnection = { peer };

    // Monitor connection state
    peer.oniceconnectionstatechange = () => {
      console.log('ICE connection state for', userId, ':', peer.iceConnectionState);
    };

    peer.onconnectionstatechange = () => {
      console.log('Connection state for', userId, ':', peer.connectionState);
    };

    // Add local stream to peer connection only if available
    if (stream) {
      stream.getTracks().forEach(track => {
        peer.addTrack(track, stream);
        console.log('Added track:', track.kind, 'to peer connection');
      });
      peerConnection.addedLocalTracks = true;
    } else {
      console.log('No local media available — creating receive-only peer connection');
    }

    // Handle ICE candidates
    peer.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          to: userId
        });
      }
    };

    // Handle incoming stream
    peer.ontrack = (event) => {
      console.log('Received track from:', userId, 'Track kind:', event.track.kind);
      console.log('Event streams:', event.streams);
      if (event.streams && event.streams[0]) {
        peerConnection.stream = event.streams[0];
        console.log('Stream set for peer:', userId, 'Stream tracks:', event.streams[0].getTracks().length);
        peersRef.current.set(userId, peerConnection);
        setPeers(new Map(peersRef.current));
      } else {
        console.error('No stream in track event for peer:', userId);
      }
    };

    peersRef.current.set(userId, peerConnection);
    setPeers(new Map(peersRef.current));

    // If initiator, create offer
    if (isInitiator) {
      peer.onnegotiationneeded = async () => {
        try {
          const offer = await peer.createOffer();
          await peer.setLocalDescription(offer);
          if (socketRef.current) {
            socketRef.current.emit('offer', { offer, to: userId });
          }
        } catch (error) {
          console.error('Error creating offer:', error);
        }
      };
    }
  };

  const handleOffer = async (offer: RTCSessionDescriptionInit, from: string) => {
    // Note: allow creating peer connection even if no local stream
    const stream = localStreamRef.current;

    console.log('Handling offer from:', from);
    const peer = new RTCPeerConnection(iceServers);
    const peerConnection: PeerConnection = { peer };

    // Monitor connection state
    peer.oniceconnectionstatechange = () => {
      console.log('ICE connection state for', from, ':', peer.iceConnectionState);
    };

    peer.onconnectionstatechange = () => {
      console.log('Connection state for', from, ':', peer.connectionState);
    };

    // Add local stream if available
    if (stream) {
      stream.getTracks().forEach(track => {
        peer.addTrack(track, stream);
        console.log('Added track:', track.kind, 'for answering offer');
      });
      peerConnection.addedLocalTracks = true;
    } else {
      console.log('No local media available when answering offer — creating receive-only connection');
    }

    // Handle ICE candidates
    peer.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('ice-candidate', {
          candidate: event.candidate,
          to: from
        });
      }
    };

    // Handle incoming stream
    peer.ontrack = (event) => {
      console.log('Received track from:', from, 'Track kind:', event.track.kind);
      console.log('Event streams:', event.streams);
      if (event.streams && event.streams[0]) {
        peerConnection.stream = event.streams[0];
        console.log('Stream set for peer:', from, 'Stream tracks:', event.streams[0].getTracks().length);
        peersRef.current.set(from, peerConnection);
        setPeers(new Map(peersRef.current));
      } else {
        console.error('No stream in track event for peer:', from);
      }
    };

    await peer.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    if (socketRef.current) {
      socketRef.current.emit('answer', { answer, to: from });
    }

    peersRef.current.set(from, peerConnection);
    setPeers(new Map(peersRef.current));
  };

  const removePeer = (userId: string) => {
    const peerConnection = peersRef.current.get(userId);
    if (peerConnection) {
      peerConnection.peer.close();
      peersRef.current.delete(userId);
      setPeers(new Map(peersRef.current));
    }
  };

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

    // Close all peer connections
    peersRef.current.forEach((peerConnection) => {
      peerConnection.peer.close();
    });
    peersRef.current.clear();

    // Disconnect socket
    if (socketRef.current && normalizedRoomId) {
      socketRef.current.emit('leave-room', normalizedRoomId);
      socketRef.current.disconnect();
    }
  };

  return (
    <div className="meeting-page">
      <div className="meeting-content">
        <div className="main-meeting-area">
          {peers.size === 0 ? (
            <NoPeersPlaceholder
              roomId={roomId || ''}
              normalizedRoomId={normalizedRoomId}
            />
          ) : (
            <div className="participants-grid">
              {Array.from(peers.entries()).map(([userId, peerConnection]) => (
                peerConnection.stream ? (
                  <div key={userId} className="grid-item">
                    <RemoteVideo
                      stream={peerConnection.stream}
                      displayName={peerConnection.displayName}
                    />
                  </div>
                ) : (
                  <div key={userId} className="grid-item">
                    <div className="video-container">
                      <div className="video-label">Connecting...</div>
                    </div>
                  </div>
                )
              ))}
            </div>
          )}

          <LocalVideo
            localVideoRef={localVideoRef}
            userName={userName}
            isSpeaking={isSpeaking}
          />
        </div>
      </div>

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
