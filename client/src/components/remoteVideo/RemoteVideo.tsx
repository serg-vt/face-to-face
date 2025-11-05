import { useEffect, useRef, useState } from "react";
import cn from "classnames";

import { startRemoteVoiceDetection } from "../../hooks/useMedia.ts";

interface RemoteVideoProps {
  stream: MediaStream;
  displayName?: string;
}

const RemoteVideo = ({
  stream, displayName
}: RemoteVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    console.log('RemoteVideo mounted with stream:', stream);
    console.log('Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));

    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      console.log('Set srcObject for remote video');
    }

    // Use shared remote voice detection helper
    const stop = startRemoteVoiceDetection(stream, (speaking) => {
      setIsSpeaking(speaking);
    });

    return () => {
      try { stop(); } catch (err) { /* ignore */ }
    };
  }, [stream]);

  return (
    <div className={cn('video-container', { speaking: isSpeaking })}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="video"
      />
      {displayName && <div className="video-label">{displayName}</div>}
    </div>
  );
}

export default RemoteVideo;
