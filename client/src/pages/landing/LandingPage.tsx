import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import cn from 'classnames';

import Button from "../../components/button";
import Input from "../../components/input";

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
      <div className="landing-page__section">
        <Input
          id="user-name"
          value={userName}
          onChange={(e) => setUserName(e.target.value)}
          placeholder="Enter your display name"
        />
      </div>

      <div className="landing-page__section">
        <Button
          className={cn("landing-page__button", "landing-page__create-button")}
          onClick={handleCreateMeeting}
          label="Create meeting"
        />
        <Button
          className={cn("landing-page__button", "landing-page__join-button")}
          onClick={handleJoinMeeting}
          label="Join meeting"
        />
      </div>
    </div>
  );
}

export default LandingPage;
