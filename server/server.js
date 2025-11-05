require('dotenv').config();

const express = require('express');
const path = require('path');
const mime = require('mime-types');
const app = express();
const http = require('http').createServer(app);

// Determine CORS origin based on environment
const corsOrigin = process.env.NODE_ENV === 'production'
  ? process.env.CLIENT_URL
  : true; // Allow all origins in development

const io = require('socket.io')(http, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Serve static files
if (process.env.NODE_ENV === 'production') {
  // Serve built React app in production
  const clientDistPath = path.join(__dirname, '../client/dist');

  // Configure static file serving with proper MIME types
  app.use(express.static(clientDistPath, {
    setHeaders: (res, filePath) => {
      let contentType;

      // Explicitly set for JS modules first (most important)
      if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
        contentType = 'application/javascript; charset=UTF-8';
      } else if (filePath.endsWith('.css')) {
        contentType = 'text/css; charset=UTF-8';
      } else if (filePath.endsWith('.json')) {
        contentType = 'application/json; charset=UTF-8';
      } else if (filePath.endsWith('.html')) {
        contentType = 'text/html; charset=UTF-8';
      } else {
        // For all other files, try mime.lookup
        contentType = mime.lookup(filePath) || 'application/octet-stream';
      }

      res.setHeader('Content-Type', contentType);
      console.log(`Serving: ${path.basename(filePath)} with Content-Type: ${contentType}`);
    }
  }));

  // Handle React routing - send all requests to index.html
  // Exclude socket.io and API routes
  app.get('*', (req, res) => {
    // Don't catch socket.io or static file requests
    if (req.path.startsWith('/socket.io') || req.path.includes('.')) {
      return;
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  // In development, just serve static files (not typically used)
  app.use(express.static(path.join(__dirname, '../client')));
}

// rooms: Map<roomId, Map<socketId, displayName>>
const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Expect join payload { roomId, name }
  socket.on('join-room', (payload) => {
    const { roomId: rawRoomId, name } = (typeof payload === 'string') ? { roomId: payload, name: 'Guest' } : payload || {};
    if (!rawRoomId) return;
    const roomId = String(rawRoomId).toLowerCase();

    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }

    const roomMap = rooms.get(roomId);

    // Prepare existing users list (array of { id, name }) before adding the new user
    const existingUsers = Array.from(roomMap.entries()).map(([id, displayName]) => ({ id, name: displayName }));

    // Add/replace this socket's display name in the room map
    roomMap.set(socket.id, name || 'Guest');

    // Send list of existing users to the new joiner
    socket.emit('existing-users', existingUsers);

    // Notify others in room about the new user (send { id, name })
    socket.to(roomId).emit('user-connected', { id: socket.id, name: name || 'Guest' });

    console.log(`User ${socket.id} (${name}) joined room ${roomId}. Existing users:`, existingUsers);
  });

  socket.on('offer', (data) => {
    console.log(`Relaying offer from ${socket.id} to ${data.to}`);
    socket.to(data.to).emit('offer', {
      offer: data.offer,
      from: socket.id
    });
  });

  socket.on('answer', (data) => {
    console.log(`Relaying answer from ${socket.id} to ${data.to}`);
    socket.to(data.to).emit('answer', {
      answer: data.answer,
      from: socket.id
    });
  });

  socket.on('ice-candidate', (data) => {
    console.log(`Relaying ICE candidate from ${socket.id} to ${data.to}`);
    socket.to(data.to).emit('ice-candidate', {
      candidate: data.candidate,
      from: socket.id
    });
  });

  socket.on('leave-room', (rawRoomId) => {
    const roomId = String(rawRoomId || '').toLowerCase();
    socket.leave(roomId);
    if (rooms.has(roomId)) {
      rooms.get(roomId).delete(socket.id);
      socket.to(roomId).emit('user-disconnected', socket.id);
      console.log(`User ${socket.id} left room ${roomId}`);
    }
  });

  socket.on('disconnect', () => {
    rooms.forEach((usersMap, roomId) => {
      if (usersMap.has(socket.id)) {
        usersMap.delete(socket.id);
        socket.to(roomId).emit('user-disconnected', socket.id);
      }
    });
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
