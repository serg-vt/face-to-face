# Video Conference Application

A basic video conference application built with WebRTC, Node.js, Express, and Socket.IO.

## Features
- Real-time peer-to-peer video and audio communication
- Room-based video calls
- Simple and clean UI
- Multiple participants support

## Project Structure
```
face-to-face/
├── server/
│   ├── server.js        # Signaling server
│   └── package.json     # Server dependencies
└── client/
    ├── index.html       # Main HTML page
    ├── style.css        # Styles
    └── app.js           # Client-side WebRTC logic
```

## Setup Instructions

### 1. Install Dependencies
Navigate to the server directory and install dependencies:
```bash
cd server
npm install
```

### 2. Start the Server
```bash
npm start
```

The server will start on `http://localhost:3000`

**Start the React Client (in a separate terminal):**
```bash
npm run client
```
The client will start on `http://localhost:5173` (Vite default port)

### 3. Test the Application
1. Open `http://localhost:5173` in your browser
2. Enter your display name
3. Click "Create Meeting" to start a new meeting or "Join Meeting" to join an existing one
4. Allow camera and microphone access when prompted
5. Share the room ID with others to join

### 4. Access from Local Network (Optional)
The app is configured to work on your local network!

1. Find your computer's IP address:
   - Windows: `ipconfig` → Look for IPv4 Address (e.g., 192.168.1.100)
   - Mac/Linux: `ifconfig` or `ip addr show`

2. Access from other devices on same WiFi:
   - Client: `http://192.168.1.100:5173`
   - Both devices must be on the same WiFi network

See `LOCAL_NETWORK.md` for detailed instructions.

## How It Works

### WebRTC
- Uses WebRTC for peer-to-peer video/audio streaming
- STUN server (Google's public STUN server) helps establish connections through NAT

### Signaling Server
- Socket.IO handles the signaling process
- Exchanges WebRTC offers, answers, and ICE candidates between peers
- Manages room joining and user disconnection

### Client
- Captures local media (camera/microphone)
- Creates RTCPeerConnection for each remote peer
- Handles WebRTC negotiation and displays video streams

## Technologies Used
- **Backend**: Node.js, Express, Socket.IO
- **Frontend**: React 19, TypeScript, React Router, Vite
- **Real-time Communication**: WebRTC, Socket.IO Client
- **Styling**: CSS3 with Material Design principles

## Current Features
✅ Landing page with user name input
✅ Create Meeting with auto-generated room ID
✅ Join Meeting with room ID prompt
✅ React Router with URL-based routing (`/meeting/:roomId`)
✅ WebRTC video/audio streaming (peer-to-peer)
✅ **Multi-participant support** (2-8 users recommended)
✅ **Multi-tab support** - join same meeting from different tabs/browsers
✅ **Voice activity detection** - blue border highlight when speaking
✅ Real-time audio analysis with Web Audio API
✅ Enable/Disable microphone button
✅ Enable/Disable camera button
✅ Leave call functionality
✅ Dynamic participant join/leave handling
✅ Session storage for user preferences
✅ Responsive grid layout for video feeds

## Next Steps for Enhancement
- Add screen sharing capability
- Display participant names on video feeds
- Add chat functionality
- Show room ID on meeting page for easy sharing
- Add copy-to-clipboard for meeting links
- Improve error handling and loading states
- Add reconnection logic
- Add participant count display
- Add support for more than 2 participants efficiently
- Add waiting room feature

## Browser Support
Works in modern browsers that support WebRTC:
- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera

## Notes
- For production use, consider using a TURN server for better connectivity
- Currently optimized for 2-4 participants (peer-to-peer mesh)
- For larger groups, consider using a media server (SFU/MCU)

