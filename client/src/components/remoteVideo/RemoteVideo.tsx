import { useEffect, useRef, useState } from "react";
import cn from "classnames";

import { startRemoteVoiceDetection } from "../../hooks/useMedia.ts";

interface RemoteVideoProps {
  stream: MediaStream | undefined;
  displayName?: string;
}

const RemoteVideo = ({
  stream,
  displayName,
}: RemoteVideoProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!stream) return;

    console.log('RemoteVideo mounted with stream:', stream);
    console.log('Stream tracks:', stream.getTracks().map(t => ({ kind: t.kind, enabled: t.enabled })));

    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      console.log('Set srcObject for remote video');
    }

    const stop = startRemoteVoiceDetection(stream, (speaking) => {
      setIsSpeaking(speaking);
    });

    return () => {
      try { stop(); } catch (err) { /* ignore */ }
    };
  }, [stream]);

  return stream ? (
    <div className={
      cn("remote-video__container", {
        "remote-video__container--speaking": isSpeaking
      })
    }>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="remote-video__feed"
      />
      {displayName && <div className="remote-video__label">{displayName}</div>}
    </div>
  ) : (
    <div className="remote-video__container">
      <div className="remote-video__label">Connecting...</div>
    </div>
  );
}

export default RemoteVideo;
