import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import cn from 'classnames';
import './LandingPage.scss';

const LandingPage = () => {
  const [userName, setUserName] = useState('');
  const navigate = useNavigate();

  const generateRoomId = () => {
    // produce an 8-char lowercase alphanumeric id
    return Math.random().toString(36).substring(2, 10).toLowerCase();
  };

  const handleCreateMeeting = () => {
    if (!userName.trim()) {
      alert('Please enter your display name');
      return;
    }
    const roomId = generateRoomId();

    // Store userName in sessionStorage
    sessionStorage.setItem('userName', userName.trim());

    // Navigate to meeting page
    navigate(`/meeting/${roomId}`);
  };

  const handleJoinMeeting = () => {
    if (!userName.trim()) {
      alert('Please enter your display name');
      return;
    }
    const roomId = prompt('Enter Room ID:');
    if (roomId && roomId.trim()) {
      // Store userName in sessionStorage
      sessionStorage.setItem('userName', userName.trim());

      // Normalize to lowercase for consistency
      navigate(`/meeting/${roomId.trim().toLowerCase()}`);
    }
  };

  return (
    <div className="landing-page">
      <div className="landing-content">
        <div className="name-input-section">
          <input
            type="text"
            id="user-name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            placeholder="Enter your display name"
            maxLength={50}
            className="name-input"
          />
        </div>

        <div className="action-buttons">
          <button
            onClick={handleCreateMeeting}
            className={cn('btn', 'btn-primary')}
            disabled={!userName.trim()}
          >
            Create Meeting
          </button>
          <button
            onClick={handleJoinMeeting}
            className={cn('btn', 'btn-secondary')}
            disabled={!userName.trim()}
          >
            Join Meeting
          </button>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
