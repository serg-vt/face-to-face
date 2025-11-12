import React, { createContext, useContext, useCallback, useRef, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

// Types
export interface RemotePeer {
  id: string;
  stream?: MediaStream;
  displayName?: string;
  isSpeaking?: boolean;
}

interface MediaContextValue {
  // Local media
  localStream: MediaStream | null;
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isSpeaking: boolean;

  // Remote peers
  remotePeers: Map<string, RemotePeer>;

  // Device management
  availableDevices: MediaDeviceInfo[];
  selectedAudioDeviceId: string | null;
  selectedVideoDeviceId: string | null;
  setSelectedAudioDeviceId: (id: string | null) => void;
  setSelectedVideoDeviceId: (id: string | null) => void;

  // Permissions & errors
  permissionStatus: { camera?: string; microphone?: string };
  mediaError: string | null;

  // Actions
  initializeMedia: () => Promise<void>;
  retryWithSelectedDevices: () => Promise<void>;
  enumerateDevices: () => Promise<void>;
  toggleAudio: () => void;
  toggleVideo: () => void;
  updatePermissionStatus: () => Promise<void>;

  // Remote peer management
  addRemotePeer: (id: string, displayName?: string) => void;
  updateRemotePeerStream: (id: string, stream: MediaStream) => void;
  removeRemotePeer: (id: string) => void;
  updateRemotePeerSpeaking: (id: string, isSpeaking: boolean) => void;

  // Cleanup
  cleanup: () => void;
}

const MediaContext = createContext<MediaContextValue | null>(null);

// Hook to use the context
export const useMediaContext = () => {
  const context = useContext(MediaContext);
  if (!context) {
    throw new Error('useMediaContext must be used within MediaProvider');
  }
  return context;
};

// Provider component
interface MediaProviderProps {
  children: ReactNode;
}

export const MediaProvider: React.FC<MediaProviderProps> = ({ children }) => {
  // Local media state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Remote peers state
  const [remotePeers, setRemotePeers] = useState<Map<string, RemotePeer>>(new Map());
  const remotePeersRef = useRef<Map<string, RemotePeer>>(new Map());

  // Voice detection refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const remoteAnalysersRef = useRef<Map<string, { context: AudioContext; analyser: AnalyserNode }>>(new Map());

  // Device management state
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string | null>(null);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<{ camera?: string; microphone?: string }>({});
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  // Cleanup function
  const cleanup = useCallback(() => {
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
    }
    localStreamRef.current = null;
    setLocalStream(null);

    // Close local audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;

    // Close all remote audio contexts
    remoteAnalysersRef.current.forEach(({ context }) => {
      context.close();
    });
    remoteAnalysersRef.current.clear();

    // Clear remote peers
    remotePeersRef.current.clear();
    setRemotePeers(new Map());
  }, []);

  // Device enumeration
  const enumerateDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAvailableDevices(devices);
    } catch (err) {
      console.warn('Error enumerating devices:', err);
    }
  }, []);

  // Permission status
  const updatePermissionStatus = useCallback(async () => {
    try {
      if ((navigator as any).permissions && (navigator as any).permissions.query) {
        const cameraPerm = await (navigator as any).permissions.query({ name: 'camera' });
        const micPerm = await (navigator as any).permissions.query({ name: 'microphone' });
        setPermissionStatus({ camera: cameraPerm.state, microphone: micPerm.state });
        cameraPerm.onchange = () => setPermissionStatus(prev => ({ ...prev, camera: (cameraPerm as any).state }));
        micPerm.onchange = () => setPermissionStatus(prev => ({ ...prev, microphone: (micPerm as any).state }));
      }
    } catch (err) {
      console.warn('Permissions API not available:', err);
    }
  }, []);

  // Try get user media helper
  const tryGetUserMedia = async (constraints: MediaStreamConstraints) => {
    try {
      const s = await navigator.mediaDevices.getUserMedia(constraints);
      return { stream: s, error: null };
    } catch (err: any) {
      console.warn('getUserMedia failed for constraints', constraints, 'error:', err?.name ? `${err.name}: ${err.message}` : err);
      return { stream: null, error: err };
    }
  };

  // Voice detection for local stream
  const setupLocalVoiceDetection = useCallback((stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.smoothingTimeConstant = 0.8;
      analyser.fftSize = 1024;

      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

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
    } catch (error) {
      console.error('Error setting up local voice detection:', error);
    }
  }, []);

  // Voice detection for remote stream
  const setupRemoteVoiceDetection = useCallback((peerId: string, stream: MediaStream) => {
    try {
      // Clean up existing analyser for this peer
      const existing = remoteAnalysersRef.current.get(peerId);
      if (existing) {
        existing.context.close();
        remoteAnalysersRef.current.delete(peerId);
      }

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.smoothingTimeConstant = 0.8;
      analyser.fftSize = 1024;

      source.connect(analyser);

      remoteAnalysersRef.current.set(peerId, { context: audioContext, analyser });

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkAudioLevel = () => {
        const analyserData = remoteAnalysersRef.current.get(peerId);
        if (!analyserData) return;

        analyserData.analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;

        const threshold = 15;
        const speaking = average > threshold;

        // Update peer speaking status
        updateRemotePeerSpeaking(peerId, speaking);

        requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
    } catch (error) {
      console.error('Error setting up remote voice detection for peer', peerId, error);
    }
  }, []);

  // Initialize media
  const initializeMedia = useCallback(async () => {
    setMediaError(null);
    await updatePermissionStatus();

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

    await enumerateDevices();

    let stream: MediaStream | null = null;
    let lastError: any = null;

    // Try user-selected devices first
    if (selectedAudioDeviceId || selectedVideoDeviceId) {
      const constraints: MediaStreamConstraints = {
        audio: selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : true,
        video: selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : true
      };
      const res = await tryGetUserMedia(constraints);
      stream = res.stream;
      lastError = res.error || lastError;
    }

    // Fallback strategies
    if (!stream) {
      const res = await tryGetUserMedia({ video: true, audio: true });
      stream = res.stream;
      lastError = res.error || lastError;
    }

    if (!stream) {
      const res = await tryGetUserMedia({ audio: true });
      stream = res.stream;
      lastError = res.error || lastError;
    }

    if (!stream) {
      const res = await tryGetUserMedia({ video: true });
      stream = res.stream;
      lastError = res.error || lastError;
    }

    if (!stream && availableDevices.length > 0) {
      const audioInput = availableDevices.find(d => d.kind === 'audioinput');
      const videoInput = availableDevices.find(d => d.kind === 'videoinput');

      if (audioInput) {
        const res = await tryGetUserMedia({ audio: { deviceId: { exact: audioInput.deviceId } } });
        stream = res.stream;
        lastError = res.error || lastError;
      }

      if (!stream && videoInput) {
        const res = await tryGetUserMedia({ video: { deviceId: { exact: videoInput.deviceId } } });
        stream = res.stream;
        lastError = res.error || lastError;
      }
    }

    if (stream) {
      localStreamRef.current = stream;
      setLocalStream(stream);
      setupLocalVoiceDetection(stream);
      setIsAudioEnabled(Boolean(stream.getAudioTracks().length && stream.getAudioTracks()[0].enabled));
      setIsVideoEnabled(Boolean(stream.getVideoTracks().length && stream.getVideoTracks()[0].enabled));
      setMediaError(null);
    } else {
      const errType = lastError?.name || 'UnknownError';
      let friendly = 'Unable to acquire camera/microphone.';
      switch (errType) {
        case 'NotAllowedError':
        case 'PermissionDeniedError':
          friendly = 'Permissions denied. Please allow camera and microphone access in your browser.';
          break;
        case 'NotFoundError':
        case 'DevicesNotFoundError':
          friendly = "No camera or microphone found. Make sure devices are connected.";
          break;
        case 'NotReadableError':
        case 'TrackStartError':
          friendly = 'Device is already in use by another application. Close other apps and retry.';
          break;
        case 'OverconstrainedError':
        case 'ConstraintNotSatisfiedError':
          friendly = 'Requested device constraints cannot be satisfied. Try a different device.';
          break;
        default:
          friendly = 'Unable to access media devices. Check browser permissions and device availability.';
      }

      console.warn('Media init failed:', { errType, lastError, availableDevices });
      setMediaError(`${friendly} (${errType}${lastError?.message ? ': ' + lastError.message : ''})`);

      localStreamRef.current = null;
      setLocalStream(null);
      setIsAudioEnabled(false);
      setIsVideoEnabled(false);
    }
  }, [selectedAudioDeviceId, selectedVideoDeviceId, availableDevices, updatePermissionStatus, enumerateDevices, setupLocalVoiceDetection]);

  // Retry with selected devices
  const retryWithSelectedDevices = useCallback(async () => {
    setMediaError(null);
    await updatePermissionStatus();
    await enumerateDevices();

    const constraints: MediaStreamConstraints = {
      audio: selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : true,
      video: selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : true
    };

    const res = await tryGetUserMedia(constraints);
    const s = res.stream;
    const err = res.error;

    if (s) {
      localStreamRef.current = s;
      setLocalStream(s);
      setupLocalVoiceDetection(s);
      setIsAudioEnabled(Boolean(s.getAudioTracks().length && s.getAudioTracks()[0].enabled));
      setIsVideoEnabled(Boolean(s.getVideoTracks().length && s.getVideoTracks()[0].enabled));
      setMediaError(null);
    } else {
      const errName = err?.name ? `${err.name}: ` : '';
      setMediaError(`${errName}${err?.message || 'Retry failed. Check device selection and permissions.'}`);
    }
  }, [selectedAudioDeviceId, selectedVideoDeviceId, updatePermissionStatus, enumerateDevices, setupLocalVoiceDetection]);

  // Toggle audio
  const toggleAudio = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    const stream = localStreamRef.current;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  }, []);

  // Remote peer management
  const addRemotePeer = useCallback((id: string, displayName?: string) => {
    const peer: RemotePeer = {
      id,
      displayName,
      isSpeaking: false
    };
    remotePeersRef.current.set(id, peer);
    setRemotePeers(new Map(remotePeersRef.current));
  }, []);

  const updateRemotePeerStream = useCallback((id: string, stream: MediaStream) => {
    const peer = remotePeersRef.current.get(id);
    if (peer) {
      peer.stream = stream;
      remotePeersRef.current.set(id, peer);
      setRemotePeers(new Map(remotePeersRef.current));

      // Setup voice detection for this stream
      setupRemoteVoiceDetection(id, stream);
    }
  }, [setupRemoteVoiceDetection]);

  const updateRemotePeerSpeaking = useCallback((id: string, isSpeaking: boolean) => {
    const peer = remotePeersRef.current.get(id);
    if (peer && peer.isSpeaking !== isSpeaking) {
      peer.isSpeaking = isSpeaking;
      remotePeersRef.current.set(id, peer);
      setRemotePeers(new Map(remotePeersRef.current));
    }
  }, []);

  const removeRemotePeer = useCallback((id: string) => {
    // Clean up voice detection
    const analyser = remoteAnalysersRef.current.get(id);
    if (analyser) {
      analyser.context.close();
      remoteAnalysersRef.current.delete(id);
    }

    // Remove peer
    remotePeersRef.current.delete(id);
    setRemotePeers(new Map(remotePeersRef.current));
  }, []);

  const value: MediaContextValue = {
    // Local media
    localStream,
    localStreamRef,
    isAudioEnabled,
    isVideoEnabled,
    isSpeaking,

    // Remote peers
    remotePeers,

    // Device management
    availableDevices,
    selectedAudioDeviceId,
    selectedVideoDeviceId,
    setSelectedAudioDeviceId,
    setSelectedVideoDeviceId,

    // Permissions & errors
    permissionStatus,
    mediaError,

    // Actions
    initializeMedia,
    retryWithSelectedDevices,
    enumerateDevices,
    toggleAudio,
    toggleVideo,
    updatePermissionStatus,

    // Remote peer management
    addRemotePeer,
    updateRemotePeerStream,
    removeRemotePeer,
    updateRemotePeerSpeaking,

    // Cleanup
    cleanup
  };

  return (
    <MediaContext.Provider value={value}>
      {children}
    </MediaContext.Provider>
  );
};

