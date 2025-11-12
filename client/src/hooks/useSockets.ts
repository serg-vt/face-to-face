import { useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useMediaContext } from '../contexts/MediaContext';

export interface PeerConnection {
  peer: RTCPeerConnection;
  stream?: MediaStream;
  isSpeaking?: boolean;
  addedLocalTracks?: boolean;
  displayName?: string;
  pendingIceCandidates?: RTCIceCandidateInit[];
}

interface UseSocketsProps {
  roomId: string;
  userName: string;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' }
  ]
};

const useSockets = ({ roomId, userName }: UseSocketsProps) => {
  const { localStreamRef, addRemotePeer, updateRemotePeerStream, removeRemotePeer } = useMediaContext();
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());

  // Function to add local tracks to a peer connection
  const addLocalTracksToAllPeers = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    console.log('Adding local tracks to all existing peers');
    peersRef.current.forEach((peerConnection, userId) => {
      // Only add tracks if we haven't already
      if (!peerConnection.addedLocalTracks) {
        console.log('Adding tracks to peer:', userId);
        stream.getTracks().forEach(track => {
          try {
            peerConnection.peer.addTrack(track, stream);
            console.log('Added track:', track.kind, 'to existing peer connection');
          } catch (error) {
            console.error('Error adding track to peer:', error);
          }
        });
        peerConnection.addedLocalTracks = true;
        peersRef.current.set(userId, peerConnection);
      }
    });
    setPeers(new Map(peersRef.current));
  }, [localStreamRef, updateRemotePeerStream]);

  const createPeerConnection = useCallback((userId: string, isInitiator: boolean) => {
    const stream = localStreamRef.current;

    console.log('Creating peer connection to:', userId, 'isInitiator:', isInitiator);
    const peer = new RTCPeerConnection(ICE_SERVERS);
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
  }, [localStreamRef, updateRemotePeerStream]);

  const handleOffer = useCallback(async (offer: RTCSessionDescriptionInit, from: string) => {
    const stream = localStreamRef.current;

    console.log('Handling offer from:', from);
    const peer = new RTCPeerConnection(ICE_SERVERS);
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

    // Process any pending ICE candidates
    if (peerConnection.pendingIceCandidates && peerConnection.pendingIceCandidates.length > 0) {
      console.log('Processing', peerConnection.pendingIceCandidates.length, 'pending ICE candidates for', from);
      for (const candidate of peerConnection.pendingIceCandidates) {
        try {
          await peer.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error('Error adding pending ICE candidate:', error);
        }
      }
      peerConnection.pendingIceCandidates = [];
    }

    const answer = await peer.createAnswer();
    await peer.setLocalDescription(answer);

    if (socketRef.current) {
      socketRef.current.emit('answer', { answer, to: from });
    }

    peersRef.current.set(from, peerConnection);
    setPeers(new Map(peersRef.current));
  }, [localStreamRef, updateRemotePeerStream]);

  const removePeer = useCallback((userId: string) => {
    const peerConnection = peersRef.current.get(userId);
    if (peerConnection) {
      peerConnection.peer.close();
      peersRef.current.delete(userId);
      setPeers(new Map(peersRef.current));
    }

    // Remove from MediaContext
    removeRemotePeer(userId);
  }, [removeRemotePeer]);

  const initializeSocket = useCallback(() => {
    // Prevent multiple socket initializations
    if (socketRef.current) {
      console.log('Socket already initialized, skipping...');
      return;
    }

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
    const socket = io(serverUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Connected to server:', socket.id);
      // Send both roomId and display name
      socket.emit('join-room', { roomId, name: userName });
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
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

        // Process any pending ICE candidates
        if (peerConnection.pendingIceCandidates && peerConnection.pendingIceCandidates.length > 0) {
          console.log('Processing', peerConnection.pendingIceCandidates.length, 'pending ICE candidates for', from);
          for (const candidate of peerConnection.pendingIceCandidates) {
            try {
              await peerConnection.peer.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (error) {
              console.error('Error adding pending ICE candidate:', error);
            }
          }
          peerConnection.pendingIceCandidates = [];
        }
      }
    });

    socket.on('ice-candidate', async ({ candidate, from }: { candidate: RTCIceCandidateInit; from: string }) => {
      console.log('Received ICE candidate from:', from);
      const peerConnection = peersRef.current.get(from);
      if (peerConnection) {
        try {
          // If remote description is not set yet, queue the candidate
          if (!peerConnection.peer.remoteDescription) {
            console.log('Queueing ICE candidate for', from, '- remote description not set yet');
            if (!peerConnection.pendingIceCandidates) {
              peerConnection.pendingIceCandidates = [];
            }
            peerConnection.pendingIceCandidates.push(candidate);
          } else {
            await peerConnection.peer.addIceCandidate(new RTCIceCandidate(candidate));
            console.log('Added ICE candidate from:', from);
          }
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
  }, [roomId, userName, createPeerConnection, handleOffer, removePeer, addRemotePeer]);

  const disconnect = useCallback(() => {
    // Close all peer connections
    peersRef.current.forEach((peerConnection) => {
      peerConnection.peer.close();
    });
    peersRef.current.clear();
    setPeers(new Map());

    // Disconnect socket
    if (socketRef.current) {
      socketRef.current.emit('leave-room', roomId);
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, [roomId]);

  return {
    peers,
    initializeSocket,
    disconnect,
    addLocalTracksToAllPeers
  };
};

export default useSockets;

