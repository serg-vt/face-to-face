# Quick Start Guide - Multi-Tab Testing

## Start the Application

### Terminal 1 - Start Server
```bash
cd C:\Workspace\Projects\face-to-face
npm run server
```
Wait for: `Server running on http://localhost:3000`

### Terminal 2 - Start Client
```bash
cd C:\Workspace\Projects\face-to-face
npm run client
```
Wait for: `Local: http://localhost:5173`

## Test Multi-Tab Support (2 Participants)

### Tab 1 - Create Meeting
1. Open browser: `http://localhost:5173`
2. Enter name: **Alice**
3. Click: **CREATE MEETING**
4. **Copy the room ID** from URL (e.g., `/meeting/A7B3C9D1`)

### Tab 2 - Join Meeting
1. Open **NEW TAB**: `http://localhost:5173`
2. Enter name: **Bob**
3. Click: **JOIN MEETING**
4. Paste room ID: `A7B3C9D1`
5. Click: **OK**

## Expected Result

✅ **Tab 1 shows:**
- Your video (Alice) with green border
- Bob's video with transparent border
- Controls at bottom

✅ **Tab 2 shows:**
- Your video (Bob) with green border
- Alice's video with transparent border
- Controls at bottom

✅ **When you speak:**
- Blue border appears around your video
- Blue border appears in both tabs
- Smooth animation

## Test with 3+ Tabs

Just repeat Tab 2 steps with different names:
- Tab 3: Enter room ID → Carol joins
- Tab 4: Enter room ID → Dave joins
- All participants see everyone!

## Quick Test Commands

### Alternative: Direct URL Join
Instead of Join Meeting button, just open:
```
http://localhost:5173/meeting/A7B3C9D1
```

### Test Voice Detection
1. Play music or speak near microphone
2. Watch for blue border highlight
3. Test in multiple tabs

### Test Controls
- Click microphone icon → mutes audio
- Click camera icon → stops video
- Click "LEAVE CALL" → returns to landing page

That's it! You're ready to test multi-tab meetings! 🚀

