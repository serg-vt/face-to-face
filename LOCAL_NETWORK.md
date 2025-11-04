# Local Network Access Guide

## ✅ Client App Now Accessible on Local Network

Your Face to Face application is now configured to be accessible from any device on your local network!

## Configuration Changes Made

### 1. Vite Dev Server (Client)
**File: `client/vite.config.ts`**

Added server configuration:
```typescript
server: {
  host: '0.0.0.0',  // Exposes to all network interfaces
  port: 5173,
  strictPort: true,
}
```

### 2. Socket.IO Server (Backend)
**File: `server/server.js`**

Updated CORS policy:
```javascript
cors: {
  origin: true,  // Allow all origins
  methods: ["GET", "POST"],
  credentials: true
}
```

### 3. Client Socket Connection
**File: `client/src/components/MeetingPage.tsx`**

Dynamic server URL:
```typescript
const serverUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
const socket = io(serverUrl);
```

## How to Use

### Step 1: Find Your Local IP Address

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter (usually starts with 192.168.x.x or 10.0.x.x)

**Mac/Linux:**
```bash
ifconfig
# or
ip addr show
```

Example IP: `192.168.1.100`

### Step 2: Start Both Servers

**Terminal 1 - Server:**
```bash
cd C:\Workspace\Projects\face-to-face
npm run server
```
Server runs on: `http://0.0.0.0:3000`

**Terminal 2 - Client:**
```bash
cd C:\Workspace\Projects\face-to-face
npm run client
```

You'll see output like:
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.100:5173/
```

### Step 3: Access from Other Devices

#### From Your Computer (Host):
```
http://localhost:5173
```

#### From Other Devices on Same Network:
```
http://192.168.1.100:5173
```
*(Replace with your actual IP address)*

## Testing Scenarios

### Test 1: Same Computer, Different Browsers
1. Open Chrome: `http://localhost:5173`
2. Open Firefox: `http://localhost:5173`
3. Create meeting in Chrome
4. Join from Firefox with room ID
✅ Should work perfectly

### Test 2: Phone on Same WiFi
1. Open browser on your computer
2. Create a meeting, note the room ID
3. On your phone, open browser and go to: `http://192.168.1.100:5173`
4. Join the meeting with the room ID
✅ Should see both video feeds

### Test 3: Tablet + Computer
1. Computer: `http://192.168.1.100:5173` → Create meeting
2. Tablet: `http://192.168.1.100:5173` → Join meeting
✅ P2P WebRTC connection between devices

### Test 4: Multiple Devices (3+)
1. Device A creates meeting
2. Device B joins
3. Device C joins
4. Device D joins
✅ All should see each other

## Network Requirements

### Same WiFi Network
- All devices must be on the **same WiFi network**
- Both 2.4GHz and 5GHz bands work
- Guest networks may have isolation (won't work)

### Firewall Settings
You may need to allow:
- **Port 3000** - Node.js server (Socket.IO)
- **Port 5173** - Vite dev server (React app)

**Windows Firewall:**
1. Windows Security → Firewall & network protection
2. Allow an app through firewall
3. Add Node.js if prompted

**Mac Firewall:**
1. System Preferences → Security & Privacy → Firewall
2. Firewall Options → Allow Node

## Troubleshooting

### Issue: "Cannot access http://192.168.x.x:5173"

**Solution 1: Check IP Address**
- Verify you're using the correct IP from `ipconfig`/`ifconfig`
- IP should start with 192.168.x.x or 10.0.x.x

**Solution 2: Check Firewall**
- Temporarily disable firewall to test
- If it works, add firewall exceptions for ports 3000 and 5173

**Solution 3: Check Network**
- Ensure all devices are on same WiFi network
- Not on guest network (often isolated)
- Not using VPN on either device

### Issue: "Client loads but can't connect to server"

**Check Console:**
Open browser DevTools (F12) and look for errors like:
```
WebSocket connection failed
```

**Solution:**
- Ensure server is running (`npm run server`)
- Check server is accessible: `http://192.168.1.100:3000`
- Verify CORS settings in server.js

### Issue: "Video/Audio not working on mobile"

**Solution:**
- Mobile browsers require **HTTPS** for getUserMedia
- For testing, some browsers allow localhost without HTTPS
- For production, you'll need SSL certificates

**Temporary Fix:**
- On Android Chrome: Enable "Insecure origins treated as secure"
  - chrome://flags/#unsafely-treat-insecure-origin-as-secure
  - Add: `http://192.168.1.100:5173`

### Issue: WebRTC connection fails between devices

**Check:**
1. Both devices can access the client
2. Both devices can ping each other
3. STUN server is accessible (Google's public STUN)

**Network Types:**
- ✅ **Home WiFi**: Should work perfectly
- ✅ **Office WiFi**: May work (depends on network config)
- ❌ **Public WiFi**: Often blocked (security)
- ❌ **Cellular + WiFi**: Won't work (different networks)

## Device Compatibility

### Desktop Browsers
- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

### Mobile Browsers
- ✅ Chrome (Android)
- ✅ Safari (iOS)
- ✅ Firefox (Android)
- ⚠️ Samsung Internet (May need flags)

### Tablets
- ✅ iPad Safari
- ✅ Android Chrome
- ✅ Surface Edge

## Security Considerations

### Development Mode (Current Setup)
- ⚠️ CORS allows all origins (`origin: true`)
- ⚠️ No authentication required
- ⚠️ Anyone on network can access
- ⚠️ HTTP only (not encrypted)

**This is fine for local testing but NOT for production!**

### Production Recommendations
1. Use HTTPS (SSL certificates)
2. Implement authentication
3. Restrict CORS to specific domains
4. Add rate limiting
5. Use environment variables for config

## Quick Reference

### Your URLs (Replace IP)
```
Computer (localhost):
- Client: http://localhost:5173
- Server: http://localhost:3000

Local Network:
- Client: http://192.168.1.100:5173
- Server: http://192.168.1.100:3000
```

### Ports Used
- **5173** - Vite dev server (React client)
- **3000** - Node.js server (Socket.IO signaling)
- **Random** - WebRTC peer connections (negotiated)

### Commands
```bash
# Start server
npm run server

# Start client (with network access)
npm run client

# Find your IP (Windows)
ipconfig

# Find your IP (Mac/Linux)
ifconfig
```

## Example Test Session

**Step-by-step:**

1. **On your computer:**
   ```bash
   npm run server  # Terminal 1
   npm run client  # Terminal 2
   ```

2. **Note the Network URL:**
   ```
   ➜  Network: http://192.168.1.100:5173/
   ```

3. **Create meeting on computer:**
   - Open: http://localhost:5173
   - Enter name: "Alice"
   - Click "Create Meeting"
   - Note room ID: "A7B3C9D1"

4. **Join from phone:**
   - Connect to same WiFi
   - Open: http://192.168.1.100:5173
   - Enter name: "Bob"
   - Click "Join Meeting"
   - Enter room ID: "A7B3C9D1"

5. **Result:**
   - Alice sees Bob's video
   - Bob sees Alice's video
   - Voice detection works
   - Controls work on both

## Performance Tips

### For Better Performance:
- Use 5GHz WiFi (if available)
- Stay close to router
- Close unnecessary apps
- Use modern devices
- Limit participants (2-4 optimal)

### Network Bandwidth:
- **Good**: 5+ Mbps upload per participant
- **Minimum**: 2 Mbps upload per participant
- **HD Quality**: 10+ Mbps recommended

## Next Steps

Once testing is successful, consider:
1. Deploy to cloud (Heroku, Vercel, AWS)
2. Add HTTPS with Let's Encrypt
3. Use TURN server for better connectivity
4. Add authentication system
5. Implement proper error handling

Your app is now ready for local network testing! 🎉

Access it from any device on your network and enjoy testing your video conference app!

