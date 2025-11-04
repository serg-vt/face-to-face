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

const rooms = new Map();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Set());
    }

    // Get existing users in the room before adding new user
    const existingUsers = Array.from(rooms.get(roomId) || []);

    // Add new user to room
    rooms.get(roomId).add(socket.id);

    // Send list of existing users to the new joiner
    socket.emit('existing-users', existingUsers);

    // Notify others in room about new user
    socket.to(roomId).emit('user-connected', socket.id);

    console.log(`User ${socket.id} joined room ${roomId}. Existing users:`, existingUsers);
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

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    if (rooms.has(roomId)) {
      rooms.get(roomId).delete(socket.id);
      socket.to(roomId).emit('user-disconnected', socket.id);
      console.log(`User ${socket.id} left room ${roomId}`);
    }
  });

  socket.on('disconnect', () => {
    rooms.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        users.delete(socket.id);
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

