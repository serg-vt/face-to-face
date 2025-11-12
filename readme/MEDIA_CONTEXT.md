# MediaContext Implementation

## Overview

Implemented a centralized **MediaContext** to manage all media-related state and logic across the application. This replaces the scattered media management and provides a single source of truth for local and remote media streams.

## What Was Implemented

### 1. Created `MediaContext.tsx`

A React Context Provider that centralizes:

#### **Local Media Management**
- Local stream acquisition and management
- Audio/Video toggle controls
- Voice detection (speaking indicator)
- Device enumeration and selection
- Permission status tracking
- Error handling and user-friendly messages

#### **Remote Peers Management**
- Remote peer tracking (id, displayName, stream, isSpeaking)
- Automatic voice detection for all remote streams
- Centralized peer lifecycle (add, update, remove)
- Stream synchronization

#### **Device Management**
- Available devices listing (cameras, microphones)
- Device selection with retry logic
- Multiple fallback strategies for media acquisition
- Permission API integration

### 2. Context API

```typescript
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
```

### 3. Remote Peer Interface

```typescript
interface RemotePeer {
  id: string;
  stream?: MediaStream;
  displayName?: string;
  isSpeaking?: boolean;
}
```

## Architecture Changes

### Before MediaContext

**Scattered State Management:**
```
┌─────────────────┐
│  MeetingPage    │
├─────────────────┤
│ useMedia hook   │ ← Local media only
│ useSockets hook │ ← Peer connections + remote streams
│ RemoteVideo     │ ← Own voice detection
└─────────────────┘
```

**Issues:**
- ❌ Duplicate voice detection logic
- ❌ Remote streams managed in useSockets (wrong responsibility)
- ❌ No centralized media state
- ❌ Hard to share media state across components

### After MediaContext

**Centralized Architecture:**
```
┌──────────────────────────────┐
│       MediaProvider          │
│  (wraps entire app)          │
├──────────────────────────────┤
│  Local Media State           │
│  Remote Peers State          │
│  Voice Detection (all)       │
│  Device Management           │
└──────────────────────────────┘
         ↓
┌─────────────────┬─────────────────┐
│  MeetingPage    │   useSockets    │
├─────────────────┼─────────────────┤
│ useMediaContext │ useMediaContext │
│ - localStream   │ - localStreamRef│
│ - remotePeers   │ - addRemotePeer │
│ - controls      │ - updateStream  │
└─────────────────┴─────────────────┘
```

**Benefits:**
- ✅ Single source of truth for all media
- ✅ Centralized voice detection
- ✅ Proper separation of concerns
- ✅ Easy to add features (recording, screen share, etc.)
- ✅ Testable and maintainable

## Files Modified

### 1. **Created:** `client/src/contexts/MediaContext.tsx`
- New context provider with all media logic
- Local and remote media management
- Centralized voice detection for all streams
- Device management and permissions
- ~500 lines of well-organized code

### 2. **Updated:** `client/src/App.tsx`
```typescript
// Wrapped app with MediaProvider
<MediaProvider>
  <Router>
    {/* routes */}
  </Router>
</MediaProvider>
```

### 3. **Updated:** `client/src/hooks/useSockets.ts`
- Removed `localStreamRef` from props (now from context)
- Added MediaContext integration:
  - `addRemotePeer()` when user connects
  - `updateRemotePeerStream()` when tracks arrive
  - `removeRemotePeer()` when user disconnects
- Syncs WebRTC peer state with MediaContext

### 4. **Updated:** `client/src/pages/meeting/MeetingPage.tsx`
- Replaced `useMedia()` hook with `useMediaContext()`
- Uses `remotePeers` from context instead of local state
- Simplified cleanup logic (calls `cleanupMedia()`)
- Passes `isSpeaking` prop to RemoteVideo components

### 5. **Updated:** `client/src/components/remoteVideo/RemoteVideo.tsx`
- Removed duplicate voice detection logic
- Now receives `isSpeaking` prop from MediaContext
- Simplified component (removed useState, removed audio setup)
- Cleaner and more focused on rendering

## Voice Detection

### Centralized Implementation

**Local Voice Detection:**
```typescript
const setupLocalVoiceDetection = (stream: MediaStream) => {
  const audioContext = new AudioContext();
  const analyser = audioContext.createAnalyser();
  const microphone = audioContext.createMediaStreamSource(stream);
  
  analyser.smoothingTimeConstant = 0.8;
  analyser.fftSize = 1024;
  microphone.connect(analyser);
  
  // Continuous audio level checking
  const checkAudioLevel = () => {
    analyser.getByteFrequencyData(dataArray);
    const average = sum / bufferLength;
    const threshold = 15;
    setIsSpeaking(average > threshold);
    requestAnimationFrame(checkAudioLevel);
  };
};
```

**Remote Voice Detection:**
```typescript
const setupRemoteVoiceDetection = (peerId: string, stream: MediaStream) => {
  // Same logic but updates remotePeers map
  const checkAudioLevel = () => {
    analyser.getByteFrequencyData(dataArray);
    const speaking = average > threshold;
    updateRemotePeerSpeaking(peerId, speaking);
    requestAnimationFrame(checkAudioLevel);
  };
};
```

**Benefits:**
- ✅ Consistent threshold and algorithm
- ✅ Automatic cleanup when peers disconnect
- ✅ No duplicate code
- ✅ Centralized performance optimization

## Media Initialization Strategy

### Fallback Chain

The context implements a robust fallback strategy:

```typescript
1. Try user-selected devices (if any)
   ↓ fails
2. Try { video: true, audio: true }
   ↓ fails
3. Try { audio: true } only
   ↓ fails
4. Try { video: true } only
   ↓ fails
5. Try first available audio device
   ↓ fails
6. Try first available video device
   ↓ fails
7. Return graceful error with user-friendly message
```

### Error Messages

User-friendly error messages for common issues:
- `NotAllowedError` → "Permissions denied. Please allow camera and microphone access."
- `NotFoundError` → "No camera or microphone found. Make sure devices are connected."
- `NotReadableError` → "Device is already in use by another application."
- `OverconstrainedError` → "Requested device constraints cannot be satisfied."

## Remote Peer Lifecycle

### Flow

**1. User Connects:**
```typescript
socket.on('user-connected', ({ id, name }) => {
  addRemotePeer(id, name);           // ← Add to MediaContext
  createPeerConnection(id, false);    // ← Create WebRTC connection
});
```

**2. Stream Arrives:**
```typescript
peer.ontrack = (event) => {
  if (event.streams[0]) {
    updateRemotePeerStream(userId, event.streams[0]); // ← Update MediaContext
    setupRemoteVoiceDetection(userId, event.streams[0]); // ← Auto setup
  }
};
```

**3. User Disconnects:**
```typescript
socket.on('user-disconnected', (userId) => {
  removePeer(userId);                 // ← Close WebRTC connection
  removeRemotePeer(userId);           // ← Remove from MediaContext
  // Voice detection automatically cleaned up
});
```

## Benefits of MediaContext

### 1. **Single Source of Truth**
All media state in one place. No prop drilling, no duplicate state.

### 2. **Proper Separation of Concerns**
- `MediaContext` → Media management
- `useSockets` → WebRTC signaling
- `MeetingPage` → UI orchestration
- `RemoteVideo` → Rendering only

### 3. **Scalability**
Easy to add new features:
- Screen sharing → Add to MediaContext
- Recording → Access all streams from context
- Audio/Video filters → Centralized processing
- Virtual backgrounds → Intercept stream in one place

### 4. **Testability**
```typescript
// Easy to test
const { result } = renderHook(() => useMediaContext(), {
  wrapper: MediaProvider
});

expect(result.current.localStream).toBeNull();
await act(() => result.current.initializeMedia());
expect(result.current.localStream).toBeTruthy();
```

### 5. **Performance**
- Voice detection runs once per stream (not per component)
- AudioContext reused efficiently
- Proper cleanup prevents memory leaks

### 6. **Developer Experience**
```typescript
// Before - scattered state
const { localStream } = useMedia();
const { peers } = useSockets();
const [isSpeaking, setIsSpeaking] = useState(false);

// After - everything in context
const { 
  localStream, 
  remotePeers, 
  isSpeaking,
  toggleAudio,
  toggleVideo 
} = useMediaContext();
```

## Future Enhancements

The MediaContext architecture makes these easy to add:

1. **Screen Sharing**
   ```typescript
   startScreenShare: () => Promise<void>;
   stopScreenShare: () => void;
   screenStream: MediaStream | null;
   ```

2. **Recording**
   ```typescript
   startRecording: () => void;
   stopRecording: () => Blob;
   isRecording: boolean;
   ```

3. **Audio/Video Effects**
   ```typescript
   applyVideoFilter: (filter: VideoFilter) => void;
   applyAudioEffect: (effect: AudioEffect) => void;
   ```

4. **Network Quality**
   ```typescript
   networkQuality: 'excellent' | 'good' | 'poor';
   updateNetworkQuality: (peerId: string, quality: number) => void;
   ```

5. **Picture-in-Picture**
   ```typescript
   enterPiP: (peerId: string) => Promise<void>;
   exitPiP: () => void;
   ```

## Build Status

✅ **Build successful**
✅ **No TypeScript errors**
✅ **All voice detection centralized**
✅ **Remote peers properly managed**
✅ **Ready for deployment**

## Migration Summary

- ❌ **Removed:** `useMedia` hook usage from MeetingPage
- ❌ **Removed:** Duplicate voice detection in RemoteVideo
- ❌ **Removed:** Remote stream management from useSockets state
- ✅ **Added:** MediaContext with comprehensive media management
- ✅ **Added:** Centralized voice detection for all streams
- ✅ **Added:** Remote peer management in context
- ✅ **Updated:** All components to use MediaContext
- ✅ **Updated:** useSockets to sync with MediaContext

---

**The application now has a clean, scalable, and maintainable media architecture! 🎉**

