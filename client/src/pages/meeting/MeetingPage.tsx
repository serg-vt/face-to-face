import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { BsMicFill, BsMicMuteFill, BsCameraVideoFill, BsCameraVideoOffFill } from 'react-icons/bs';
import { MdCallEnd } from 'react-icons/md';
import cn from 'classnames';
import styles from './MeetingPage.module.scss';

interface PeerConnection {
  peer: RTCPeerConnection;
  stream?: MediaStream;
  isSpeaking?: boolean;
  addedLocalTracks?: boolean; // whether we've already added local tracks to this peer
}

const MeetingPage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const userName = sessionStorage.getItem('userName') || 'Guest';
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Map<string, PeerConnection>>(new Map());
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  };

  useEffect(() => {
    // Redirect if no roomId
    if (!roomId) {
      navigate('/');
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
  }, [roomId, navigate]);

  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      // Store in ref immediately for peer connections
      localStreamRef.current = stream;
      setLocalStream(stream);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Setup voice activity detection
      setupVoiceDetection(stream);

      // Set initial enabled flags based on available tracks
      setIsAudioEnabled(Boolean(stream.getAudioTracks().length && stream.getAudioTracks()[0].enabled));
      setIsVideoEnabled(Boolean(stream.getVideoTracks().length && stream.getVideoTracks()[0].enabled));

      console.log('Media stream initialized, ready for peer connections');

      // If peers already exist (we joined without media), attach local tracks to them now
      addLocalTracksToPeers();
    } catch (error) {
      // If user denied permissions or no devices available, allow joining without media
      console.warn('Could not access media devices, joining without local media:', error);
      localStreamRef.current = null;
      setLocalStream(null);

      // Ensure UI reflects no local media available
      setIsAudioEnabled(false);
      setIsVideoEnabled(false);
    }
  };

  // Attach local media tracks to any existing peer connections (used when media becomes available after joining)
  const addLocalTracksToPeers = async () => {
    const stream = localStreamRef.current;
    if (!stream) return;
    if (!peersRef.current || peersRef.current.size === 0) return;

    peersRef.current.forEach(async (peerConnection, userId) => {
      try {
        if (!peerConnection.addedLocalTracks) {
          // Add all local tracks
          stream.getTracks().forEach(track => {
            peerConnection.peer.addTrack(track, stream);
            console.log('Added late local track:', track.kind, 'to peer:', userId);
          });

          peerConnection.addedLocalTracks = true;

          // Renegotiate: create an offer so remote peer will receive new tracks
          if (socketRef.current) {
            try {
              const offer = await peerConnection.peer.createOffer();
              await peerConnection.peer.setLocalDescription(offer);
              socketRef.current.emit('offer', { offer, to: userId });
              console.log('Sent renegotiation offer to', userId);
            } catch (err) {
              console.error('Error during renegotiation with', userId, err);
            }
          }
        }
      } catch (err) {
        console.error('Failed to add local tracks to peer', userId, err);
      }
    });
  };

  const setupVoiceDetection = (stream: MediaStream) => {
    try {
      // Create audio context and analyser
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.smoothingTimeConstant = 0.8;
      analyser.fftSize = 1024;

      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // Start monitoring audio levels
      detectVoiceActivity();
    } catch (error) {
      console.error('Error setting up voice detection:', error);
    }
  };

  const detectVoiceActivity = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkAudioLevel = () => {
      if (!analyserRef.current) return;

      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;

      // Threshold for speaking detection (adjust as needed)
      const threshold = 15;
      setIsSpeaking(average > threshold);

      // Continue monitoring
      requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  };

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
      socket.emit('join-room', roomId);
    });

    socket.on('existing-users', (users: string[]) => {
      console.log('Existing users in room:', users);
      // New joiner initiates connections to all existing users
      users.forEach(userId => {
        console.log('Initiating connection to existing user:', userId);
        createPeerConnection(userId, true);
      });
    });

    socket.on('user-connected', (userId: string) => {
      console.log('User connected:', userId);
      // Existing user does NOT initiate - will receive offer from new user
      // Just log, peer connection will be created when offer arrives
      console.log('New user joined, waiting for their offer');
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

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const handleLeave = () => {
    cleanup();
    sessionStorage.removeItem('userName');
    navigate('/');
  };

  const cleanup = () => {
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    localStreamRef.current = null;

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    // Close all peer connections
    peersRef.current.forEach((peerConnection) => {
      peerConnection.peer.close();
    });
    peersRef.current.clear();

    // Disconnect socket
    if (socketRef.current && roomId) {
      socketRef.current.emit('leave-room', roomId);
      socketRef.current.disconnect();
    }
  };

  return (
    <div className={styles['meeting-page']}>
      {/* Main content area */}
      <div className={styles['meeting-content']}>
        {/* Left sidebar with participants */}
        <div className={styles['participants-sidebar']}>
          <h3 className={styles['sidebar-title']}>Participants ({peers.size + 1})</h3>
          <div className={styles['participants-list']}>
            {/* Remote Videos */}
            {peers.size === 0 ? (
              <div className={styles['no-participants']}>
                <p>Waiting for others to join...</p>
                <p className={styles['room-id-hint']}>Share room ID: <strong>{roomId}</strong></p>
              </div>
            ) : (
              Array.from(peers.entries()).map(([userId, peerConnection]) => {
                console.log('Rendering peer:', userId, 'has stream:', !!peerConnection.stream);
                return peerConnection.stream ? (
                  <RemoteVideo
                    key={userId}
                    stream={peerConnection.stream}
                  />
                ) : (
                  <div key={userId} className={styles['video-container']}>
                    <div className={styles['video-label']}>Connecting...</div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Main meeting area */}
        <div className={styles['main-meeting-area']}>
          {/* Local Video - Bottom Right */}
          <div className={cn(styles['local-video-container'], { [styles.speaking]: isSpeaking })}>
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={styles['local-video']}
            />
            <div className={styles['video-label']}>You ({userName})</div>
          </div>
        </div>
      </div>

      {/* Controls Toolbar */}
      <div className={styles['controls-toolbar']}>
        <button
          className={cn(styles['control-btn'], { [styles.disabled]: !isAudioEnabled })}
          onClick={toggleAudio}
          title={isAudioEnabled ? 'Mute' : 'Unmute'}
        >
          {isAudioEnabled ? <BsMicFill /> : <BsMicMuteFill />}
        </button>

        <button
          className={cn(styles['control-btn'], { [styles.disabled]: !isVideoEnabled })}
          onClick={toggleVideo}
          title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isVideoEnabled ? <BsCameraVideoFill /> : <BsCameraVideoOffFill />}
        </button>

        <button
          className={cn(styles['control-btn'], styles['leave-btn'])}
          onClick={handleLeave}
          title="Leave call"
        >
          <MdCallEnd />
          <span>Leave Call</span>
        </button>
      </div>
    </div>
  );
}

// Remote Video Component
interface RemoteVideoProps {
  stream: MediaStream;
}

function RemoteVideo({ stream }: RemoteVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    console.log('RemoteVideo mounted with stream:', stream);
    console.log('Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));

    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      console.log('Set srcObject for remote video');
    }

    // Setup voice detection for remote stream
    setupRemoteVoiceDetection(stream);

    return () => {
      // Cleanup audio context
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stream]);

  const setupRemoteVoiceDetection = (remoteStream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(remoteStream);

      analyser.smoothingTimeConstant = 0.8;
      analyser.fftSize = 1024;

      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      detectRemoteVoiceActivity();
    } catch (error) {
      console.error('Error setting up remote voice detection:', error);
    }
  };

  const detectRemoteVoiceActivity = () => {
    if (!analyserRef.current) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkAudioLevel = () => {
      if (!analyserRef.current) return;

      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;

      const threshold = 15;
      setIsSpeaking(average > threshold);

      requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  };

  return (
    <div className={cn(styles['video-container'], { [styles.speaking]: isSpeaking })}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={styles.video}
      />
      <div className={styles['video-label']}>Participant</div>
    </div>
  );
}

export default MeetingPage;
