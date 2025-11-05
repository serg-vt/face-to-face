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
    <div className={
      cn("local-video__container", {
        "local-video__container--speaking": isSpeaking
      })
    }>
      <video
        ref={localVideoRef}
        autoPlay
        playsInline
        muted
        className="local-video__feed"
      />
      {userName && <div className="local-video__label">You ({userName})</div>}
    </div>
  )
}

export default LocalVideo;
