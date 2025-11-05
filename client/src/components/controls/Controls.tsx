import cn from 'classnames';

import {
  BsCameraVideoFill,
  BsCameraVideoOffFill,
  BsMicFill,
  BsMicMuteFill,
  BsTelephoneXFill
} from "react-icons/bs";

import IconButton from "../iconButton";

import "./Controls.scss";

interface ControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  localStream: MediaStream | null;
  toggleAudio: () => void;
  toggleVideo: () => void;
  handleLeave: () => void;
}

const Controls = ({
  isAudioEnabled,
  isVideoEnabled,
  localStream,
  toggleAudio,
  toggleVideo,
  handleLeave,
}: ControlsProps) => {
  return (
    <div className="controls">
      <div className="controls__left">
        <IconButton
          className={cn("controls__mic-button", {
            "controls__mic-button--off": !isAudioEnabled,
            "controls__mic-button--disabled": !localStream,
          })}
          disabled={!localStream}
          icon={isAudioEnabled ? <BsMicFill /> : <BsMicMuteFill />}
          onClick={toggleAudio}
        />
        <IconButton
          className={cn("controls__video-button", {
            "controls__video-button--disabled": !localStream,
            "controls__video-button--off": !isVideoEnabled,
          })}
          disabled={!localStream}
          icon={isVideoEnabled ? <BsCameraVideoFill /> : <BsCameraVideoOffFill />}
          onClick={toggleVideo}
        />
      </div>
      <div className="controls__right">
        <IconButton
          className="controls__leave-button"
          onClick={handleLeave}
          icon={<BsTelephoneXFill />}
        />
      </div>
    </div>
  )
}

export default Controls;
