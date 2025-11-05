import { FiCopy } from "react-icons/fi";

import "./NoPeersPlaceholder.scss";
import { useState } from "react";

interface NoPeersPlaceholderProps {
  roomId: string;
  normalizedRoomId: string;
}

const NoPeersPlaceholder = ({
  roomId,
  normalizedRoomId,
}: NoPeersPlaceholderProps) => {
  const [copied, setCopied] = useState(false);

  return (
    <div className="empty-center">
      <h2>Waiting for others to join...</h2>
      <p className="room-id-hint">Room ID: <strong>{normalizedRoomId || roomId}</strong></p>
      <div style={{marginTop:12}}>
        <button
          className="copy-btn"
          onClick={async () => {
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
          }}
          aria-label="Copy room ID"
        >
          <FiCopy style={{ marginRight: 8 }} />
          Copy Room ID
        </button>
        {copied && <span className="copied-feedback">Copied!</span>}
      </div>
    </div>
  )
}

export default NoPeersPlaceholder;
