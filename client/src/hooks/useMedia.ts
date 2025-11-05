import { useEffect, useRef, useState } from 'react';

export interface UseMediaResult {
  localStream: MediaStream | null;
  localStreamRef: React.MutableRefObject<MediaStream | null>;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isSpeaking: boolean;
  availableDevices: MediaDeviceInfo[];
  selectedAudioDeviceId: string | null;
  setSelectedAudioDeviceId: (id: string | null) => void;
  selectedVideoDeviceId: string | null;
  setSelectedVideoDeviceId: (id: string | null) => void;
  permissionStatus: { camera?: string; microphone?: string };
  mediaError: string | null;
  initializeMedia: () => Promise<void>;
  retryWithSelectedDevices: () => Promise<void>;
  enumerateDevices: () => Promise<void>;
  attachLocalTracksToPeer: (peer: RTCPeerConnection) => boolean;
  toggleAudio: () => void;
  toggleVideo: () => void;
  updatePermissionStatus: () => Promise<void>;
}

export default function useMedia(): UseMediaResult {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string | null>(null);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<{ camera?: string; microphone?: string }>({});
  const [mediaError, setMediaError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      // cleanup on unmount
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      analyserRef.current = null;
    };
  }, []);

  const enumerateDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setAvailableDevices(devices);
    } catch (err) {
      console.warn('Error enumerating devices:', err);
    }
  };

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
      console.warn('Permissions API not available:', err);
    }
  };

  const tryGetUserMedia = async (constraints: MediaStreamConstraints) => {
    try {
      const s = await navigator.mediaDevices.getUserMedia(constraints as MediaStreamConstraints);
      return { stream: s as MediaStream, error: null };
    } catch (err: any) {
      console.warn('getUserMedia failed for constraints', constraints, 'error:', err && err.name ? `${err.name}: ${err.message}` : err);
      return { stream: null, error: err };
    }
  };

  const setupVoiceDetection = (stream: MediaStream) => {
    try {
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);

      analyser.smoothingTimeConstant = 0.8;
      analyser.fftSize = 1024;

      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

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

  const initializeMedia = async () => {
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

    // try user-selected devices first
    if (selectedAudioDeviceId || selectedVideoDeviceId) {
      const constraints: MediaStreamConstraints = {
        audio: selectedAudioDeviceId ? { deviceId: { exact: selectedAudioDeviceId } } : true,
        video: selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : true
      };
      const res = await tryGetUserMedia(constraints);
      stream = res.stream;
      lastError = res.error || lastError;
    }

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

    if (!stream && availableDevices && availableDevices.length > 0) {
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
      setupVoiceDetection(stream);
      setIsAudioEnabled(Boolean(stream.getAudioTracks().length && stream.getAudioTracks()[0].enabled));
      setIsVideoEnabled(Boolean(stream.getVideoTracks().length && stream.getVideoTracks()[0].enabled));
      setMediaError(null);
    } else {
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
          friendly = 'Device is already in use by another application or cannot be started. Close other apps and retry.';
          break;
        case 'OverconstrainedError':
        case 'ConstraintNotSatisfiedError':
          friendly = 'Requested device constraints cannot be satisfied. Try selecting a different device or use default settings.';
          break;
        default:
          friendly = 'Unable to access media devices. Check browser permissions, OS privacy settings, and whether another app is using the device.';
      }

      console.warn('Media init failed:', { errType, lastError, availableDevices });
      setMediaError(`${friendly} (${errType}${lastError && lastError.message ? ': ' + lastError.message : ''})`);

      localStreamRef.current = null;
      setLocalStream(null);
      setIsAudioEnabled(false);
      setIsVideoEnabled(false);
    }
  };

  const retryWithSelectedDevices = async () => {
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
      setupVoiceDetection(s);
      setIsAudioEnabled(Boolean(s.getAudioTracks().length && s.getAudioTracks()[0].enabled));
      setIsVideoEnabled(Boolean(s.getVideoTracks().length && s.getVideoTracks()[0].enabled));
      setMediaError(null);
    } else {
      const errName = err && err.name ? `${err.name}: ` : '';
      setMediaError(`${errName}${err && err.message ? err.message : 'Retry failed. Check device selection and permissions.'}`);
    }
  };

  const attachLocalTracksToPeer = (peer: RTCPeerConnection) => {
    const stream = localStreamRef.current;
    if (!stream) return false;

    try {
      stream.getTracks().forEach(track => {
        peer.addTrack(track, stream);
      });
      return true;
    } catch (err) {
      console.error('Failed to attach local tracks to peer', err);
      return false;
    }
  };

  const toggleAudio = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    const stream = localStreamRef.current;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoEnabled(videoTrack.enabled);
      }
    }
  };

  return {
    localStream,
    localStreamRef,
    isAudioEnabled,
    isVideoEnabled,
    isSpeaking,
    availableDevices,
    selectedAudioDeviceId,
    setSelectedAudioDeviceId,
    selectedVideoDeviceId,
    setSelectedVideoDeviceId,
    permissionStatus,
    mediaError,
    initializeMedia,
    retryWithSelectedDevices,
    enumerateDevices,
    attachLocalTracksToPeer,
    toggleAudio,
    toggleVideo,
    updatePermissionStatus
  };
}

// Start voice-activity detection for a remote MediaStream. Returns a stop function to cancel monitoring and release resources.
export function startRemoteVoiceDetection(remoteStream: MediaStream, onSpeakingChange: (speaking: boolean) => void): () => void {
  if (!remoteStream) {
    return () => {};
  }

  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let rafId: number | null = null;

  try {
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(remoteStream);

    analyser.smoothingTimeConstant = 0.8;
    analyser.fftSize = 1024;

    source.connect(analyser);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const checkAudioLevel = () => {
      if (!analyser) return;
      analyser.getByteFrequencyData(dataArray);

      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;
      const threshold = 15; // same threshold used elsewhere
      try {
        onSpeakingChange(average > threshold);
      } catch (err) {
        console.error('Error in onSpeakingChange callback:', err);
      }

      rafId = requestAnimationFrame(checkAudioLevel);
    };

    checkAudioLevel();
  } catch (err) {
    console.error('startRemoteVoiceDetection failed:', err);
  }

  return () => {
    if (rafId) cancelAnimationFrame(rafId);
    if (audioContext) {
      audioContext.close().catch(() => {});
    }
    audioContext = null;
    analyser = null;
  };
}
