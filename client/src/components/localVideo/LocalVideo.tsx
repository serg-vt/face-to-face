import type { RefObject } from "react";
import cn from "classnames";

import "./LocalVideo.scss";

interface LocalVideoProps {
  localVideoRef: RefObject<HTMLVideoElement | null>;
  userName: string;
  isSpeaking: boolean;
}

const LocalVideo = ({
  localVideoRef,
  userName,
  isSpeaking,
}: LocalVideoProps) => {
  return (
    <div className={cn('local-video-container', { speaking: isSpeaking })}>
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className="local-video"
      />
      <div className="video-label">You ({userName})</div>
    </div>
  )
}

export default LocalVideo;
