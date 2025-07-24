import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
import cors from 'cors';

app.use(cors({ origin: 'http://localhost:5173' }));
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // your client origin
        methods: ["GET", "POST"]
    }
});

let backendPlayers = {};

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);


    backendPlayers[socket.id] = { id: socket.id, x: 400, y: 200 };

    // Wait for client to say it's ready
    socket.on("readyForPlayers", () => {
        // Now send the current list of players to this client
        socket.emit("updatePlayers", backendPlayers);
        // And broadcast it to everyone else
        socket.broadcast.emit("updatePlayers", backendPlayers);
    });


    // Handle disconnect
    socket.on('disconnect', (reason) => {
        console.log(`Player disconnected: ${socket.id} for reason: ${reason}`);
        delete backendPlayers[socket.id];
        io.emit('updatePlayers', backendPlayers);
    });

    socket.on("playerMoved", (data) => {
        if (backendPlayers[data.playerId]) {
            backendPlayers[data.playerId].x = data.x;
            backendPlayers[data.playerId].y = data.y;
            backendPlayers[data.playerId].isMoving = data.isMoving;
            backendPlayers[data.playerId].direction = data.direction;
        }

        // Broadcast to all clients except sender
        socket.broadcast.emit("playerMoved", data);
    });

    socket.on("playerAttack", ({ playerId, direction }) => {
        // Broadcast to everyone *except* the attacker
        socket.broadcast.emit("playerAttack", { playerId, direction });
    });





});

server.listen(3000, () => {
    console.log('Multiplayer server running on http://localhost:3000');
});

