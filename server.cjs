const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for simplicity in this demo
    methods: ["GET", "POST"]
  }
});

// Store room state in memory
const rooms = {};

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create a Room
  socket.on('create_room', ({ playerName }) => {
    const roomId = "NET-" + Math.floor(1000 + Math.random() * 9000);
    
    rooms[roomId] = {
      players: [{ id: socket.id, name: playerName, playerIndex: 0 }],
      gameState: null
    };

    socket.join(roomId);
    socket.emit('room_created', { roomId, playerIndex: 0 });
    console.log(`Room ${roomId} created by ${playerName}`);
  });

  // Join a Room
  socket.on('join_room', ({ roomId, playerName }) => {
    const room = rooms[roomId];

    if (!room) {
      socket.emit('error_message', "ERREUR: Ce salon n'existe pas.");
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('error_message', "ERREUR: Le salon est complet.");
      return;
    }

    // Join
    room.players.push({ id: socket.id, name: playerName, playerIndex: 1 });
    socket.join(roomId);

    // Notify P2 they joined
    socket.emit('room_joined', { roomId, playerIndex: 1, opponentName: room.players[0].name });

    // Notify P1 that P2 joined
    io.to(room.players[0].id).emit('player_joined', { opponentName: playerName });

    // Start Game trigger
    io.in(roomId).emit('game_start', { 
      players: room.players.map(p => ({ name: p.name })) 
    });

    console.log(`${playerName} joined room ${roomId}`);
  });

  // Handle Game Moves / State Updates
  socket.on('update_game_state', ({ roomId, newState }) => {
    // Broadcast the new state to the other player in the room
    socket.to(roomId).emit('game_state_received', newState);
  });

  // Handle Chat/Emotes (Optional extension)
  socket.on('send_message', ({ roomId, message }) => {
    socket.to(roomId).emit('receive_message', message);
  });

  // Disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    // Find room and clean up
    for (const roomId in rooms) {
      const room = rooms[roomId];
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      
      if (playerIndex !== -1) {
        // Notify other player
        socket.to(roomId).emit('opponent_left');
        delete rooms[roomId];
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`CyberWord Server running on port ${PORT}`);
});