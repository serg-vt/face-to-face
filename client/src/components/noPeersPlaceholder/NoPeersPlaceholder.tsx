import { useState } from "react";
import { FiCopy } from "react-icons/fi";

import "./NoPeersPlaceholder.scss";

interface NoPeersPlaceholderProps {
  roomId: string;
  normalizedRoomId: string;
}

const NoPeersPlaceholder = ({
  roomId,
  normalizedRoomId,
}: NoPeersPlaceholderProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      const toCopy = normalizedRoomId || roomId || '';
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(toCopy);
      } else {
        // fallback
        const el = document.createElement('textarea');
        el.value = toCopy;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed', err);
    }
  }

  return (
    <div className="no-peers-placeholder">
      <h2>Waiting for others to join...</h2>
      <p className="room-id-hint">Room ID: <strong>{normalizedRoomId || roomId}</strong></p>
      <button
        className="copy-btn"
        onClick={handleCopy}
        aria-label="Copy room ID"
      >
        <FiCopy style={{ marginRight: 8 }} />
        Copy Room ID
      </button>
      {copied && <span className="copied-feedback">Copied!</span>}
    </div>
  )
}

export default NoPeersPlaceholder;
