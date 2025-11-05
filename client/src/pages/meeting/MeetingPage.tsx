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
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string | null>(null);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<{ camera?: string; microphone?: string }>({});

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

  // Reusable helper to try getUserMedia with given constraints
  const tryGetUserMedia = async (constraints: MediaStreamConstraints) => {
    try {
      console.log('Attempting getUserMedia with constraints:', constraints);
      const s = await navigator.mediaDevices.getUserMedia(constraints as MediaStreamConstraints);
      return { stream: s as MediaStream, error: null };
    } catch (err: any) {
      console.warn('getUserMedia failed for constraints', constraints, 'error:', err && err.name ? `${err.name}: ${err.message}` : err);
      return { stream: null, error: err };
    }
  };

  // Query permissions (where supported) to give user feedback
  const updatePermissionStatus = async () => {
    try {
      if ((navigator as any).permissions && (navigator as any).permissions.query) {
        const cameraPerm = await (navigator as any).permissions.query({ name: 'camera' });
        const micPerm = await (navigator as any).permissions.query({ name: 'microphone' });
        setPermissionStatus({ camera: cameraPerm.state, microphone: micPerm.state });
        cameraPerm.onchange = () => setPermissionStatus(prev => ({ ...prev, camera: (cameraPerm as any).state }));
        micPerm.onchange = () => setPermissionStatus(prev => ({ ...prev, microphone: (micPerm as any).state }));
      }
    } catch (err) {
      // Permissions API not supported in all browsers
      console.warn('Permissions API not available:', err);
    }
  };

  const initializeMedia = async () => {
    setMediaError(null);
    // update permission status so UI shows current state
    updatePermissionStatus();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const msg = 'getUserMedia not supported or not in secure context (https/localhost)';
      console.warn(msg);
      setMediaError(msg);
      localStreamRef.current = null;
      setLocalStream(null);
      setIsAudioEnabled(false);
      setIsVideoEnabled(false);
      return;
    }

    // Enumerate devices first for debugging purposes
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAvailableDevices(devices);
      console.log('Available media devices:', devices);
    } catch (err) {
      console.warn('Error enumerating devices:', err);
    }

    // 1) If user previously selected specific devices, try them first
    let stream: MediaStream | null = null;
    let lastError: any = null;
    if (selectedAudioDeviceId || selectedVideoDeviceId) {
      const constraints: MediaStreamConstraints = {
        audio: selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : true,
        video: selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : true
      };
      const res = await tryGetUserMedia(constraints);
      stream = res.stream;
      lastError = res.error || lastError;
    }

    // 2) Try combined audio+video
    if (!stream) {
      const res = await tryGetUserMedia({ video: true, audio: true });
      stream = res.stream;
      lastError = res.error || lastError;
    }

    // 3) If failed, try audio-only then video-only (useful when one device is blocked)
    if (!stream) {
      const res = await tryGetUserMedia({ audio: true });
      stream = res.stream;
      lastError = res.error || lastError;
      if (stream) console.log('Fell back to audio-only stream');
    }

    if (!stream) {
      const res = await tryGetUserMedia({ video: true });
      stream = res.stream;
      lastError = res.error || lastError;
      if (stream) console.log('Fell back to video-only stream');
    }

    // 3) If still no stream but devices exist, try explicit deviceId constraints (first available devices)
    if (!stream && availableDevices && availableDevices.length > 0) {
      const audioInput = availableDevices.find(d => d.kind === 'audioinput');
      const videoInput = availableDevices.find(d => d.kind === 'videoinput');

      if (audioInput) {
        const res = await tryGetUserMedia({ audio: { deviceId: { exact: audioInput.deviceId } } });
        stream = res.stream;
        lastError = res.error || lastError;
        if (stream) console.log('Succeeded with audio deviceId constraint', audioInput.deviceId);
      }

      if (!stream && videoInput) {
        const res = await tryGetUserMedia({ video: { deviceId: { exact: videoInput.deviceId } } });
        stream = res.stream;
        lastError = res.error || lastError;
        if (stream) console.log('Succeeded with video deviceId constraint', videoInput.deviceId);
      }
    }

    if (stream) {
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
      setMediaError(null);
    } else {
      // All attempts failed — map common errors to friendly messages and show diagnostics
      const errType = lastError && lastError.name ? lastError.name : 'UnknownError';
      let friendly = 'Unable to acquire camera/microphone.';
      switch (errType) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          friendly = 'Permissions denied. Please allow camera and microphone access in your browser for this site.';
          break;
        case 'NotFoundError':
        case 'DevicesNotFoundError':
          friendly = "No camera or microphone found. Make sure devices are connected and drivers are installed.";
          break;
        case 'NotReadableError':
        case 'TrackStartError':
          friendly = 'Device is already in use by another application or cannot be started. Close other apps (Zoom/Teams/OBS) and retry.';
          break;
        case 'OverconstrainedError':
        case 'ConstraintNotSatisfiedError':
          friendly = 'Requested device constraints cannot be satisfied. Try selecting a different device or use default settings.';
          break;
        default:
          friendly = 'Unable to access media devices. Check browser permissions, OS privacy settings, and whether another app is using the device.';
      }

      console.warn('Media init failed:', { errType, lastError, availableDevices });
      // Surface a concise friendly message to the user; full error shown in console
      setMediaError(`${friendly} (${errType}${lastError && lastError.message ? ': ' + lastError.message : ''})`);

      localStreamRef.current = null;
      setLocalStream(null);
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

  // Allow user to retry with selected device IDs from the UI
  const retryWithSelectedDevices = async () => {
    setMediaError(null);
    await updatePermissionStatus();
    // Re-enumerate devices before retry
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAvailableDevices(devices);
    } catch (err) {
      console.warn('Error enumerating devices before retry:', err);
    }

    const constraints: MediaStreamConstraints = {
      audio: selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : true,
      video: selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : true
    };

    const res = await tryGetUserMedia(constraints);
    const s = res.stream;
    const err = res.error;
    if (s) {
      // attach stream
      localStreamRef.current = s;
      setLocalStream(s);
      if (localVideoRef.current) localVideoRef.current.srcObject = s;
      setupVoiceDetection(s);
      setIsAudioEnabled(Boolean(s.getAudioTracks().length && s.getAudioTracks()[0].enabled));
      setIsVideoEnabled(Boolean(s.getVideoTracks().length && s.getVideoTracks()[0].enabled));
      addLocalTracksToPeers();
      setMediaError(null);
    } else {
      const errName = err && err.name ? `${err.name}: ` : '';
      setMediaError(`${errName}${err && err.message ? err.message : 'Retry failed. Check device selection and permissions.'}`);
    }
  };

  return (
    <div className={styles.meetingPage}>
      <div className={cn(styles.videoContainer, { [styles.speaking]: isSpeaking })}>
        <video
          ref={localVideoRef}
          className={cn(styles.video, styles.localVideo)}
          autoPlay
          muted
        />
        {Array.from(peers.keys()).map(userId => {
          const peer = peers.get(userId);
           return (
             <div key={userId} className={cn(styles.remoteVideoWrapper, { [styles.hidden]: !peer?.stream })}>
               <video
                 className={cn(styles.video, styles.remoteVideo)}
                 autoPlay
                 ref={ref => {
                   if (ref && peer?.stream) {
                     ref.srcObject = peer.stream;
                   }
                 }}
               />
               {/* Debug info */}
               <div className={styles.debugInfo}>
                 <div>User ID: {userId}</div>
                 <div>Connection State: {peer?.peer.connectionState}</div>
                 <div>ICE State: {peer?.peer.iceConnectionState}</div>
                 <div>Tracks: {peer?.stream?.getTracks().map(track => track.kind).join(', ')}</div>
               </div>
             </div>
           );
         })}
       </div>
       <div className={styles.controls}>
        <div className={styles.youLabel}>You: {userName}</div>
         <div className={styles.deviceSelectors}>
           <div className={styles.selectWrapper}>
             <label>Audio Device:</label>
             <select
               value={selectedAudioDeviceId || ''}
               onChange={e => setSelectedAudioDeviceId(e.target.value)}
               disabled={!availableDevices.length}
             >
               <option value="">Default</option>
               {availableDevices.filter(device => device.kind === 'audioinput').map(device => (
                 <option key={device.deviceId} value={device.deviceId}>
                   {device.label || `Microphone ${device.deviceId}`}
                 </option>
               ))}
             </select>
           </div>
           <div className={styles.selectWrapper}>
             <label>Video Device:</label>
             <select
               value={selectedVideoDeviceId || ''}
               onChange={e => setSelectedVideoDeviceId(e.target.value)}
               disabled={!availableDevices.length}
             >
               <option value="">Default</option>
               {availableDevices.filter(device => device.kind === 'videoinput').map(device => (
                 <option key={device.deviceId} value={device.deviceId}>
                   {device.label || `Camera ${device.deviceId}`}
                 </option>
               ))}
             </select>
           </div>
         </div>
         <div className={styles.buttons}>
           <button onClick={toggleAudio} className={styles.toggleButton}>
             {isAudioEnabled ? <BsMicFill /> : <BsMicMuteFill />}
           </button>
           <button onClick={toggleVideo} className={styles.toggleButton}>
             {isVideoEnabled ? <BsCameraVideoFill /> : <BsCameraVideoOffFill />}
           </button>
           <button onClick={handleLeave} className={styles.leaveButton}>
             <MdCallEnd />
           </button>
         </div>
         <div className={styles.permissionStatus} style={{marginTop:8,fontSize:12,color:'#666'}}>
          Permissions: camera={permissionStatus.camera || 'unknown'}, mic={permissionStatus.microphone || 'unknown'}
        </div>
         {mediaError && (
           <div className={styles.error}>
             {mediaError}
             <button onClick={retryWithSelectedDevices} className={styles.retryButton}>
               Retry
             </button>
           </div>
         )}
       </div>
     </div>
   );
 };

 export default MeetingPage;
