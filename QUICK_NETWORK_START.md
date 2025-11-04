# Quick Start - Local Network Testing

## Start the Application

### Terminal 1 - Start Server
```bash
cd C:\Workspace\Projects\face-to-face
npm run server
```
Output: `Server running on http://localhost:3000`

### Terminal 2 - Start Client
```bash
cd C:\Workspace\Projects\face-to-face
npm run client
```
Output will show:
```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

## Test on Same Computer

**Browser 1:**
```
http://localhost:5173
```

**Browser 2:**
```
http://localhost:5173
```

## Test on Local Network

### Step 1: Get Your IP Address

**Windows:**
```bash
ipconfig
```
Look for: `IPv4 Address. . . . . . . . . . . : 192.168.1.100`

**Mac/Linux:**
```bash
ifconfig
# or
hostname -I
```

### Step 2: Access from Other Devices

Replace `192.168.1.100` with your actual IP:

**From Phone/Tablet (same WiFi):**
```
http://192.168.1.100:5173
```

**From Another Computer (same WiFi):**
```
http://192.168.1.100:5173
```

## Test Scenarios

### Scenario 1: Computer + Phone
1. **Computer**: Create meeting at `http://localhost:5173`
2. **Phone**: Join meeting at `http://192.168.1.100:5173`
3. Enter the same room ID
4. ✅ Both should see each other's video

### Scenario 2: Two Phones
1. **Phone 1**: Create meeting at `http://192.168.1.100:5173`
2. **Phone 2**: Join meeting at `http://192.168.1.100:5173`
3. Enter the same room ID
4. ✅ P2P connection between phones

### Scenario 3: Multiple Devices
1. **Device A**: Create meeting
2. **Device B**: Join meeting
3. **Device C**: Join meeting
4. **Device D**: Join meeting
5. ✅ All see everyone in sidebar

## Troubleshooting

### Can't Access from Phone?

**Check 1: Same Network**
- Both devices on same WiFi
- Not on guest network

**Check 2: Firewall**
```bash
# Windows: Allow ports 3000 and 5173
# Check Windows Defender Firewall settings
```

**Check 3: IP Address**
- Verify IP with `ipconfig`
- Try: `http://192.168.1.100:5173` (your IP)

### Connection Issues?

**Test Server Access:**
```
http://192.168.1.100:3000
```
Should see: Cannot GET /

**Check Browser Console:**
- Press F12
- Look for WebSocket or CORS errors

## What Changed?

### 1. Vite Config (`client/vite.config.ts`)
```typescript
server: {
  host: '0.0.0.0',  // ← Exposes to network
  port: 5173,
}
```

### 2. Server CORS (`server/server.js`)
```javascript
cors: {
  origin: true,  // ← Allows all origins
}
```

### 3. Socket Connection (`MeetingPage.tsx`)
```typescript
const serverUrl = `${window.location.protocol}//${window.location.hostname}:3000`;
// ← Uses current hostname
```

## Security Note

⚠️ **Development Mode Only**

Current settings allow **anyone on your network** to access the app.

For production:
- Use HTTPS
- Add authentication
- Restrict CORS
- Use environment variables

## That's It!

Your app is now accessible on your local network. Test it from any device! 🎉

**Remember:** All devices must be on the **same WiFi network**.

