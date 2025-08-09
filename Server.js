import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import cors from 'cors';
import fetch from 'node-fetch'; // ensure this is installed
import { ServerEnemy } from "./src/Classes/ServerEnemy.js"; // Adjust the import path as necessary
const TILE_SIZE = 32;
import { Server as IOServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Allow CORS during development only (optional)
const io = new IOServer(server, {
    cors: {
        origin: process.env.NODE_ENV === 'development' ? '*' : undefined,
        methods: ["GET", "POST"]
    }
});

// State
const rooms = {};
// let backendPlayers = {};
// let backendEnemies = {};
// const readyPlayers = new Set();
// let currentWeather = null;
// let currentWeatherCode = null;
// let mysteryCrystals = []; // [{id, x, y, type}]
// let bloodCrystals = [];

// let currentLevel = 1;
// let levelTime = 30; // in seconds
// let levelStartTime = Date.now();
// let levelInterval = null;
// let waveSpawnInterval = null;
// let stopLoop = false;


let enemyIdCounter = 0;
let btcPrice = 30000; // fallback default
const activePlayers = new Set();
// let spawnLoopStarted = false;

const collisionGrid = JSON.parse(fs.readFileSync('./assets/Json/collisionGrid.json'));
const backgroundGrid = JSON.parse(fs.readFileSync('./assets/Json/backgroundGrid.json'));
const normalizedGrid = collisionGrid.map(row =>
    row.map(tile => (tile === true ? 1 : 0))
);

const walkGrid = backgroundGrid.map((row, y) =>
    row.map((bg, x) => {
        const collides = !!collisionGrid[y][x];   // true -> wall
        const hasBg = !!bg;                     // must have background
        return (hasBg && !collides) ? 0 : 1;
    })
);

const ATTACK_RANGE = 45;   // forward reach in px
const ATTACK_WIDTH = 36;   // blade/swing width in px (side-to-side)
const ATTACK_COOLDOWN_MS = 350; // server-side guard (matches/close to client animation)
const PLAYER_HALF = 16;

// --- SOCKET EVENTS ---
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);

    // socket.on("player-joined", () => {

    //     activePlayers.add(socket.id);
    //     console.log("Active players:", activePlayers.size);

    //     if (!spawnLoopStarted) {
    //         stopLoop = false;
    //         startWaveSpawnerForLevel(io, currentLevel);

    //         startLevelTimer(io); // ✅ Add this
    //         startMysteryCrystalSpawner();
    //         spawnLoopStarted = true;

    //         // currentWeatherCode = generateWeatherCode(currentLevel);
    //         // io.emit("weatherUpdate", { code: currentWeatherCode });
    //     }
    // });
    // socket.on("playerReady", () => {
    //     console.log(`${socket.id} is ready`);
    //     readyPlayers.add(socket.id);

    //     if (readyPlayers.size === activePlayers.size) {
    //         console.log("✅ All players are ready. Restarting game.");

    //         // Full reset
    //         backendEnemies = {};
    //         backendPlayers = {};
    //         currentLevel = 1;
    //         levelTime = 30;
    //         stopLoop = false;
    //         spawnLoopStarted = false;

    //         // Reset all ready flags
    //         readyPlayers.clear();

    //         // Emit restart signal
    //         io.emit("restartGame");

    //         // Restart game loop
    //         for (const id of activePlayers) {
    //             backendPlayers[id] = {
    //                 id,
    //                 x: 400,
    //                 y: 200,
    //                 hp: 5,
    //                 attackMultiplier: 1,
    //                 isAttacking: false,
    //                 invulnerable: false,
    //                 isFrozen: false,
    //             };
    //         }

    //         io.emit("updatePlayers", backendPlayers);

    //         startWaveSpawnerForLevel(io, currentLevel);
    //         startLevelTimer(io);
    //     }
    // });



    socket.on("readyForPlayers", () => {
        const roomCode = socket.currentRoom;
        const room = rooms[roomCode];
        if (!room) return;

        // ✅ Send existing room-specific weather, don't generate new
        socket.emit("updatePlayers", room.gameState.backendPlayers);
        socket.to(roomCode).emit("updatePlayers", room.gameState.backendPlayers);

        // ✅ Send EXISTING weather from room state
        if (room.gameState.currentWeatherCode) {
            socket.emit("weatherUpdate", { code: room.gameState.currentWeatherCode });
        }

        socket.emit("startNextLevel", {
            currentLevel: room.gameState.currentLevel,
            levelTime: room.gameState.levelTime
        });
    });


    socket.on('joinGame', (playerData) => {
        const roomCode = socket.currentRoom;
        const room = rooms[roomCode];
        if (!room) return;

        // ✅ Use room-specific player storage
        room.gameState.backendPlayers[socket.id] = {
            id: socket.id,
            x: playerData.x,
            y: playerData.y,
            hp: 5,
            isDead: false,
            invulnerable: false,
            direction: 'down',
        };

        // Send room-specific player data
        socket.emit('currentPlayers', room.gameState.backendPlayers);
        socket.to(roomCode).emit('playerJoined', room.gameState.backendPlayers[socket.id]);

        console.log(`Player ${socket.id} joined game in room ${roomCode}`);
    });

    socket.on("aoeBlast", ({ x, y, radius }) => {
        const roomCode = socket.currentRoom;
        const room = rooms[roomCode];
        if (!room) return;

        const player = room.gameState.backendPlayers[socket.id];
        if (!player || player.isDead) return;

        console.log(`[Server] AoE from ${socket.id} at (${x}, ${y}) in room ${roomCode}`);

        // ✅ Use room-specific enemies
        for (const enemy of Object.values(room.gameState.backendEnemies)) {
            const dist = Math.hypot(enemy.x - x, enemy.y - y);
            if (dist <= radius && !enemy.isDead) {
                const died = applyDamageToEnemy(enemy, 3);

                if (!died) {
                    io.to(roomCode).emit("enemyHit", { id: enemy.id, hp: enemy.hp });
                }

                if (died) {
                    io.to(roomCode).emit("enemyKilled", { id: enemy.id });
                    delete room.gameState.backendEnemies[enemy.id];
                }
            }
        }
    });





    // socket.on("disconnect", (reason) => {
    //     console.log(`Player disconnected: ${socket.id}`);
    //     activePlayers.delete(socket.id);
    //     // delete backendPlayers[socket.id];
    //     io.emit("updatePlayers", backendPlayers);

    //     // Optional: treat any disconnect as game over
    //     stopLoop = true;
    //     console.log(`[GAME OVER] Player ${socket.id} disconnected. Ending game.`);
    //     stopAllTimersAndWaves();
    //     backendEnemies = {};
    //     currentLevel = 1;
    //     levelTime = 30;


    //     io.emit("gameOver");
    // });


    socket.on("playerMoved", (data) => {
        const roomCode = socket.currentRoom;
        const room = rooms[roomCode];
        if (!room) return;

        // ✅ Use room-specific players
        if (room.gameState.backendPlayers[data.playerId]) {
            Object.assign(room.gameState.backendPlayers[data.playerId], {
                x: data.x,
                y: data.y,
                isMoving: data.isMoving,
                direction: data.direction,
                lastAttackAt: 0,
            });
        }

        socket.to(roomCode).emit("playerMoved", data);
    });


    socket.on("playerDied", () => {
        const roomCode = socket.currentRoom;
        const room = rooms[roomCode];
        if (!room) return;

        const player = room.gameState.backendPlayers[socket.id];
        if (player) {
            player.isDead = true;

            // ✅ Stop room-specific game systems
            room.gameState.stopLoop = true;
            if (room.gameState.levelInterval) {
                clearInterval(room.gameState.levelInterval);
            }
            if (room.gameState.waveSpawnInterval) {
                clearInterval(room.gameState.waveSpawnInterval);
            }

            // Reset room game state
            room.gameState.backendEnemies = {};
            room.gameState.currentLevel = 1;
            room.gameState.levelTime = 30;
            room.gameState.spawnLoopStarted = false;

            console.log(`[GAME OVER] Player ${socket.id} died in room ${roomCode}.`);

            // ✅ Send individual victory/defeat messages
            const otherPlayers = room.players.filter(id => id !== socket.id);
            console.log(otherPlayers)
            // Tell the dead player they lost
            socket.emit("playerDied", { win: false, loserId: socket.id, roomCode });

            // Tell other players they won
            otherPlayers.forEach(playerId => {
                io.to(playerId).emit("playerDied", { win: true, loserId: socket.id, roomCode });
            });
        }
    });


    socket.on("updatePlayerHP", ({ hp }) => {
        const roomCode = socket.currentRoom;
        const room = rooms[roomCode];
        if (!room) return;

        const player = room.gameState.backendPlayers[socket.id];
        if (player) {
            player.hp = hp;

            if (hp <= 0) {
                player.isDead = true;

                // ✅ Send individual results like main playerDied handler
                const otherPlayers = room.players.filter(id => id !== socket.id);

                // Tell the dead player they lost
                socket.emit("playerDied", { win: false, loserId: socket.id, roomCode });

                // Tell other players they won
                otherPlayers.forEach(playerId => {
                    io.to(playerId).emit("playerDied", { win: true, loserId: socket.id, roomCode });
                });
            }
        }
    });

    socket.on("setInvulnerable", ({ bool }) => {
        const roomCode = socket.currentRoom;
        const room = rooms[roomCode];
        if (!room) return;

        // ✅ Use room-specific player
        if (room.gameState.backendPlayers[socket.id]) {
            room.gameState.backendPlayers[socket.id].invulnerable = bool;
        }
    });


    socket.on("lightningStrikeRequest", ({ x, y }) => {
        const roomCode = socket.currentRoom;
        const room = rooms[roomCode];
        if (!room) return;

        const radius = 50;

        for (const playerId in room.gameState.backendPlayers) {
            const p = room.gameState.backendPlayers[playerId];
            const dist = Math.hypot(p.x - x, p.y - y);
            if (dist < radius && !p.invulnerable) {
                p.hp -= 2;
                if (p.hp <= 0) {
                    console.log(`Enemy killed a player in room ${roomCode}`);
                    p.isDead = true;

                    // ✅ Send individual results
                    const otherPlayers = room.players.filter(id => id !== playerId);

                    // Tell the dead player they lost
                    io.to(playerId).emit("playerDied", { win: false, loserId: playerId, roomCode });

                    // Tell other players they won
                    otherPlayers.forEach(winnerId => {
                        io.to(winnerId).emit("playerDied", { win: true, loserId: playerId, roomCode });
                    });
                }
            }
        }

        // ✅ Use room-specific enemies
        for (const enemyId in room.gameState.backendEnemies) {
            const e = room.gameState.backendEnemies[enemyId];
            const dist = Math.hypot(e.x - x, e.y - y);
            if (dist < radius) {
                const died = applyDamageToEnemy(e, 2);

                if (!died) {
                    io.to(roomCode).emit("enemyHit", { id: e.id, hp: e.hp });
                }

                if (died) {
                    io.to(roomCode).emit("enemyKilled", { id: e.id });
                    delete room.gameState.backendEnemies[e.id];
                }
            }
        }

        io.to(roomCode).emit("lightningStrike", { x, y });
    });


    socket.on("collectMysteryCrystal", ({ crystalId }) => {
        const roomCode = socket.currentRoom;
        const room = rooms[roomCode];
        if (!room) return;

        const player = room.gameState.backendPlayers[socket.id];

        // ✅ Use room-specific crystals
        const crystal = room.gameState.mysteryCrystals.find(c => c.id === crystalId);
        if (!player || !crystal) return;

        // Remove the crystal from server
        room.gameState.mysteryCrystals = room.gameState.mysteryCrystals.filter(c => c.id !== crystalId);

        io.to(roomCode).emit("mysteryCrystalCollected", { crystalId });

        const positive = ['massiveHeal', 'invincibility', 'speedFrenzy', 'multiAoE', 'clearEnemies'];
        const negative = ['hpDrop', 'speedLoss', 'enemyWave', 'freezePlayer', 'flipControls'];

        const roll = Math.random();
        let effect;

        if (roll < 0.4) {
            effect = 'gainSwap'; // 40%
        } else if (roll < 0.7) {
            effect = positive[Math.floor(Math.random() * positive.length)]; // 30%
        } else {
            effect = negative[Math.floor(Math.random() * negative.length)]; // 30%
        }

        const isPositive = effect === 'gainSwap' || positive.includes(effect);

        // Collector gets full effect
        socket.emit("applyMysteryEffect", { playerId: socket.id, effect });

        // Everyone else gets visual only
        socket.broadcast.emit("applyMysteryEffect", { playerId: socket.id, effect });


        // Optionally broadcast if the effect affects everyone
        if (effect === 'clearEnemies') {
            for (const id in room.gameState.backendEnemies) {
                const e = room.gameState.backendEnemies[id];
                if (!e.isDead) {
                    e.isDead = true;
                    io.to(roomCode).emit("enemyKilled", { id });
                }
            }
        } else if (effect === 'enemyWave') {
            dynamicEnemySpawn(roomCode);
            dynamicEnemySpawn(roomCode);
        }

        // Trigger backend logic like enemy spawning here if needed
        socket.to(roomCode).emit("mysteryEffectVisual", {
            x: player.x,
            y: player.y,
            text: getEffectLabel(effect),
            color: isPositive ? "#00ff00" : "#ff0000"
        });

    });

    socket.on("collectBloodCrystal", ({ crystalId, type }) => {
        const roomCode = socket.currentRoom;
        const room = rooms[roomCode];
        if (!room) return;

        const player = room.gameState.backendPlayers[socket.id];
        const crystal = room.gameState.bloodCrystals.find(c => c.id === crystalId);

        if (!player || !crystal) return;

        // Remove from server state
        room.gameState.bloodCrystals = room.gameState.bloodCrystals.filter(c => c.id !== crystalId);

        // ✅ Send effect to ALL players in the room (including collector)
        io.to(roomCode).emit("applyBloodCrystalEffect", { playerId: socket.id, type });

        // Broadcast crystal removal to all clients
        io.to(roomCode).emit("bloodCrystalCollected", { crystalId });

        // Optional: show text pop above player (you can keep this for additional text)
        let text = "";
        let color = "#ff0000ff"
        switch (type) {
            case "Vampire1":
                text = "+1 HP";
                break;
            case "Vampire2":
                text = " Speed Up!";
                color = "#ff8800"
                break;
            case "Vampire3":
                text = "Blast!";
                color = "#ff4444";
                break;
        }

        socket.to(roomCode).emit("mysteryEffectVisual", {
            x: player.x,
            y: player.y,
            text: text,
            color: color
        });
    });





    socket.on("playerAttack", ({ playerId, direction }) => {
        const roomCode = socket.currentRoom;
        const room = rooms[roomCode];
        if (!room) return;

        const pl = room.gameState.backendPlayers[playerId];
        if (!pl) return;

        // Server-side cooldown guard
        const now = Date.now();
        if (now - (pl.lastAttackAt || 0) < ATTACK_COOLDOWN_MS) {
            // still broadcast the animation so the attacker sees it in sync
            socket.to(roomCode).emit("playerAttack", { playerId, direction });
            return;
        }
        pl.lastAttackAt = now;

        // (Optional) trust the passed direction or force to server-known direction
        const face = direction || pl.direction || 'down';

        // Find all enemies inside the melee oriented-rect
        const hits = [];
        for (const id in room.gameState.backendEnemies) {
            const e = room.gameState.backendEnemies[id];
            if (e.isDead) continue;
            if (enemyInsideMeleeCone(pl, e, face)) {
                hits.push(e);
            }
        }

        // Apply damage to all hits (cleave), or just the closest if you want single-target
        const baseDmg = 1;
        const dmg = Math.max(1, Math.floor(baseDmg * (pl.attackMultiplier || 1)));

        for (const e of hits) {
            const died = applyDamageToEnemy(e, dmg);
            if (!died) {
                io.to(roomCode).emit("enemyHit", { id: e.id, hp: e.hp });
            }

            if (died) {
                io.to(roomCode).emit("enemyKilled", { id: e.id });
                spawnBloodCrystal(roomCode, e.x, e.y, e.type);
                delete room.gameState.backendEnemies[e.id];
            }
        }
        // Still broadcast the attack animation to OTHER clients
        socket.to(roomCode).emit("playerAttack", { playerId, direction: face });
    });

    // In your room creation/joining handlers:
    socket.on('createRoom', () => {
        const roomCode = generateRoomCode();
        socket.currentRoom = roomCode;

        // ✅ CREATE ROOM-SPECIFIC GAME STATE:
        rooms[roomCode] = {
            players: [socket.id],
            ready: {},

            // Game state per room
            gameState: {
                backendPlayers: {},
                backendEnemies: {},
                mysteryCrystals: [],
                bloodCrystals: [],
                currentLevel: 1,
                levelTime: 30,
                levelStartTime: Date.now(),
                levelInterval: null,
                waveSpawnInterval: null,
                stopLoop: false,
                spawnLoopStarted: false,
                currentWeatherCode: null
            }
        };

        socket.join(roomCode);
        socket.emit('roomCreated', { roomCode, player: socket.id });
    });


    // JOIN ROOM
    socket.on('joinRoom', (roomCode) => {
        const room = rooms[roomCode];
        if (!room) {
            socket.emit('joinError', 'Room not found');
            return;
        }

        if (room.players.length >= 2) {
            socket.emit('joinError', 'Room is full');
            return;
        }

        room.players.push(socket.id);
        socket.join(roomCode);
        socket.currentRoom = roomCode;
        io.to(roomCode).emit('playerJoined', room.players);
        console.log(`Socket ${socket.id} joined room ${roomCode}`);
    });

    // PLAYER READY
    socket.on("playerReady", (roomCodes, context) => {
        const roomCode = roomCodes || socket.currentRoom;
        const room = rooms[roomCode];

        if (!room) return;

        // Track ready players per room
        if (!room.ready) room.ready = {};
        room.ready[socket.id] = true;

        const allReady = room.players.length >= 2 && room.players.every(id => room.ready[id]);

        if (allReady) {
            console.log(`✅ All players ready in room ${roomCode}.`);

            // ✅ Initialize room-specific game state
            room.gameState.currentWeatherCode = generateWeatherCode(room.gameState.currentLevel);
            room.gameState.backendPlayers = {};
            room.players.forEach(playerId => {
                room.gameState.backendPlayers[playerId] = {
                    id: playerId,
                    x: 400,
                    y: 200,
                    hp: 5,
                    attackMultiplier: 1,
                    isAttacking: false,
                    invulnerable: false,
                    isFrozen: false,
                };
            });

            // Reset room game state
            room.gameState.backendEnemies = {};
            room.gameState.mysteryCrystals = [];
            room.gameState.bloodCrystals = [];
            room.gameState.currentLevel = 1;
            room.gameState.levelTime = 30;
            room.gameState.stopLoop = false;
            room.gameState.spawnLoopStarted = false;

            room.ready = {};

            // Send appropriate event
            if (context === "restart") {
                io.to(roomCode).emit("restartGame");
            } else {
                io.to(roomCode).emit("startGame");
            }

            io.to(roomCode).emit("updatePlayers", room.gameState.backendPlayers);

            io.to(roomCode).emit("weatherUpdate", { code: room.gameState.currentWeatherCode });

            // ✅ Start room-specific game systems
            setTimeout(() => {
                startWaveSpawnerForLevel(roomCode, room.gameState.currentLevel);
                startLevelTimer(roomCode);
                startMysteryCrystalSpawner(roomCode);
                room.gameState.spawnLoopStarted = true;
            }, 1000);
        }
    });




    socket.on("requestSwap", ({ playerId }) => {
        const roomCode = socket.currentRoom;
        const room = rooms[roomCode];
        if (!room) return;

        // ✅ Use room-specific players
        const player = room.gameState.backendPlayers[playerId];
        if (!player || !player.gainSwapCount || player.gainSwapCount <= 0) return;

        const otherSocketId = Object.keys(room.gameState.backendPlayers).find(id => id !== playerId);
        if (!otherSocketId) return;

        const otherPlayer = room.gameState.backendPlayers[otherSocketId];

        // Swap positions
        const tempX = player.x;
        const tempY = player.y;
        player.x = otherPlayer.x;
        player.y = otherPlayer.y;
        otherPlayer.x = tempX;
        otherPlayer.y = tempY;

        player.gainSwapCount--;

        io.to(socket.id).emit("playerSwapped", { x: player.x, y: player.y });
        io.to(otherSocketId).emit("playerSwapped", { x: otherPlayer.x, y: otherPlayer.y });
        socket.emit("updateSwapCountFrontEnd", { swapCount: player.gainSwapCount, playerId });
    });


    socket.on("swapCountUpdate", ({ swapCount, playerId }) => {
        const roomCode = socket.currentRoom;
        const room = rooms[roomCode];
        if (!room) return;

        // ✅ Use room-specific players
        if (room.gameState.backendPlayers[playerId]) {
            room.gameState.backendPlayers[playerId].gainSwapCount = swapCount;
        }
    });





    // HANDLE DISCONNECT
    // ✅ KEEP ONLY THIS DISCONNECT HANDLER:
    socket.on('disconnect', (reason) => {
        console.log(`Player disconnected: ${socket.id} (${reason})`);

        activePlayers.delete(socket.id);

        for (const [roomCode, room] of Object.entries(rooms)) {
            const playerIndex = room.players.indexOf(socket.id);
            if (playerIndex !== -1) {
                // Remove from room
                room.players.splice(playerIndex, 1);
                delete room.ready[socket.id];

                // Remove from room's player state
                delete room.gameState.backendPlayers[socket.id];

                console.log(`Socket ${socket.id} left room ${roomCode}`);

                if (room.players.length === 0) {
                    // Clean up room-specific intervals
                    if (room.gameState.levelInterval) {
                        clearInterval(room.gameState.levelInterval);
                    }
                    if (room.gameState.waveSpawnInterval) {
                        clearInterval(room.gameState.waveSpawnInterval);
                    }

                    delete rooms[roomCode];
                    console.log(`Room ${roomCode} deleted (empty)`);
                } else if (room.players.length === 1) {
                    const winner = room.players[0];
                    console.log(`[GAME OVER] Player ${socket.id} disconnected. Player ${winner} wins!`);

                    // Stop room-specific game systems
                    room.gameState.stopLoop = true;
                    if (room.gameState.levelInterval) {
                        clearInterval(room.gameState.levelInterval);
                    }
                    if (room.gameState.waveSpawnInterval) {
                        clearInterval(room.gameState.waveSpawnInterval);
                    }

                    io.to(winner).emit("playerDied", { win: true, loserId: socket.id, roomCode });
                    io.to(roomCode).emit('playerLeft', socket.id);
                } else {
                    io.to(roomCode).emit('playerLeft', socket.id);
                }

                break;
            }
        }
    });


});

// -- ROOM LOGIC --
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 6).toUpperCase(); // e.g. 'ABCD'
}

// --- ENEMY LOGIC ---
function generateUniqueEnemyId() {
    return `enemy_${enemyIdCounter++}`;
}

function getEnemySpawnWeights(level) {
    if (level <= 2) return { Vampire1: 100, Vampire2: 0, Vampire3: 0 };
    if (level <= 4) return { Vampire1: 70, Vampire2: 20, Vampire3: 0 };
    if (level <= 5) return { Vampire1: 40, Vampire2: 50, Vampire3: 10 };
    if (level <= 6) return { Vampire1: 20, Vampire2: 50, Vampire3: 30 };
    return { Vampire1: 10, Vampire2: 40, Vampire3: 50 };
}

function getRandomEnemyType(level) {
    const weights = getEnemySpawnWeights(level);
    const total = Object.values(weights).reduce((a, b) => a + b, 0);
    let rand = Math.random() * total;
    for (const [type, weight] of Object.entries(weights)) {
        if (rand < weight) return type;
        rand -= weight;
    }
    return "Vampire1";
}

function getEnemyStats(type) {
    switch (type) {
        case "Vampire1": return { hp: 2, speed: 50, type };
        case "Vampire2": return { hp: 1, speed: 120, type };
        case "Vampire3": return { hp: 4, speed: 40, type };
        default: return { hp: 1, speed: 50, type };
    }
}

function getRandomValidTile(tileWidth = 32, tileHeight = 32, maxAttempts = 30) {
    const mapHeight = collisionGrid.length;
    const mapWidth = collisionGrid[0].length;

    for (let i = 0; i < maxAttempts; i++) {
        const tileX = Math.floor(Math.random() * mapWidth);
        const tileY = Math.floor(Math.random() * mapHeight);

        const hasCollision = collisionGrid[tileY][tileX];
        const hasBackground = backgroundGrid[tileY][tileX];

        if (!hasCollision && hasBackground) {
            return {
                x: tileX * tileWidth + tileWidth / 2,
                y: tileY * tileHeight + tileHeight / 2
            };
        }
    }
    return null;
}

function dynamicEnemySpawn(roomCode) {
    const room = rooms[roomCode];
    if (!room || room.gameState.stopLoop) return;
    const extraEnemies = Math.floor(btcPrice / 10000);
    const spawnCount = 1 + extraEnemies;

    for (let i = 0; i < spawnCount; i++) {
        const type = getRandomEnemyType(room.gameState.currentLevel);
        const tile = getRandomValidTile();
        if (!tile) continue;

        const enemyId = generateUniqueEnemyId();
        const stats = getEnemyStats(type);

        room.gameState.backendEnemies[enemyId] = new ServerEnemy(
            enemyId,
            tile.x,
            tile.y,
            type,
            walkGrid, // mapGrid
            TILE_SIZE,
            {
                onHit: (playerId, payload) => io.to(playerId).emit("playerHit", payload),
                onDeath: (playerId) => {
                    const otherPlayers = room.players.filter(id => id !== playerId);

                    // Tell the dead player they lost
                    io.to(playerId).emit("playerDied", { win: false, loserId: playerId, roomCode });

                    // Tell other players they won
                    otherPlayers.forEach(winnerId => {
                        io.to(winnerId).emit("playerDied", { win: true, loserId: playerId, roomCode });
                    });
                }
            }
        );

        io.to(roomCode).emit("spawnEnemy", room.gameState.backendEnemies[enemyId].getData());

    }

    console.log(`Spawned ${spawnCount} enemies at level ${room.gameState.currentLevel} in room ${roomCode}`);
}

// ✅ Per-room enemy update
function updateEnemiesForRoom(roomCode, deltaTime, currentTime) {
    const room = rooms[roomCode];
    if (!room) return;

    const start = Date.now();
    let alive = 0;

    for (const id in room.gameState.backendEnemies) {
        const enemy = room.gameState.backendEnemies[id];
        enemy.update(deltaTime, currentTime, room.gameState.backendPlayers);
        if (enemy.isDead) {
            delete room.gameState.backendEnemies[id];
        } else {
            alive++;
        }
    }

    const cost = Date.now() - start;
    if (cost > 30) {
        console.warn(`[TICK] Room ${roomCode} updateEnemies cost=${cost}ms alive=${alive}`);
    }

    // ✅ Emit to room only
    io.to(roomCode).emit("enemyUpdate", Object.values(room.gameState.backendEnemies).map(e => e.getData()));
}

// ✅ Main update loop for all rooms
setInterval(() => {
    const now = Date.now();
    const delta = now - lastTime;
    lastTime = now;

    // Update each room independently
    Object.keys(rooms).forEach(roomCode => {
        const room = rooms[roomCode];
        if (room && room.gameState && !room.gameState.stopLoop) {
            updateEnemiesForRoom(roomCode, delta, now);
        }
    });
}, 100);


// --- PLAYER HIT ---
function dirToVector(direction) {
    switch (direction) {
        case 'up': return { x: 0, y: -1 };
        case 'down': return { x: 0, y: 1 };
        case 'left': return { x: -1, y: 0 };
        case 'right': return { x: 1, y: 0 };
        default: return { x: 0, y: 1 };
    }
}

function enemyInsideMeleeCone(player, enemy, direction) {
    const f = dirToVector(direction);
    // perpendicular (rotate facing by 90 degrees)
    const p = { x: -f.y, y: f.x };

    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;

    // forward distance (projection onto facing)
    const forward = dx * f.x + dy * f.y;
    if (forward < PLAYER_HALF * 0.2 || forward > ATTACK_RANGE + PLAYER_HALF) return false;

    // side offset (projection onto perpendicular)
    const side = Math.abs(dx * p.x + dy * p.y);
    return side <= ATTACK_WIDTH * 0.5;
}

function applyDamageToEnemy(enemy, dmg) {
    if (!enemy || enemy.isDead) return false;
    enemy.takeDamage(dmg);
    return enemy.isDead === true;
}

// --- LEVEL SYSTEM ---

function startLevelTimer(roomCode) {
    const room = rooms[roomCode];
    if (!room || room.gameState.stopLoop) {
        console.log("[startLevelTimer] Loop stopped or room not found.");
        return;
    }
    room.gameState.levelStartTime = Date.now();
    room.gameState.levelInterval = setInterval(() => {
        if (!rooms[roomCode] || room.gameState.stopLoop) {
            clearInterval(room.gameState.levelInterval);
            room.gameState.levelInterval = null;
            return;
        }
        const elapsed = Math.floor((Date.now() - room.gameState.levelStartTime) / 1000);
        const remaining = Math.max(0, room.gameState.levelTime - elapsed);

        io.to(roomCode).emit("levelTimerUpdate", {
            remaining,
            currentLevel: room.gameState.currentLevel
        });

        if (remaining <= 0) {
            clearInterval(room.gameState.levelInterval);
            room.gameState.levelInterval = null;
            nextLevel(roomCode);
        }
    }, 1000);
}


function nextLevel(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    // ✅ Use room-specific state
    room.gameState.currentLevel++;
    room.gameState.levelTime += 10;

    // ✅ Notify clients in room only
    io.to(roomCode).emit("levelComplete", { currentLevel: room.gameState.currentLevel });

    // ✅ Clear room-specific enemies
    for (const id in room.gameState.backendEnemies) {
        const enemy = room.gameState.backendEnemies[id];
        if (!enemy.isDead) {
            enemy.isDead = true;
            io.to(roomCode).emit("enemyKilled", { id });
        }
    }

    // Clear enemies after delay
    setTimeout(() => {
        room.gameState.backendEnemies = {};
    }, 2000);

    // Stop room-specific spawn interval
    if (room.gameState.waveSpawnInterval) {
        clearInterval(room.gameState.waveSpawnInterval);
    }

    // Delay before starting next level
    setTimeout(() => {
        if (!rooms[roomCode] || room.gameState.stopLoop) {
            console.log("[SPAWN LOOP] Stop loop active. Not spawning.");
            return;
        }

        room.gameState.currentWeatherCode = generateWeatherCode(room.gameState.currentLevel);
        io.to(roomCode).emit("weatherUpdate", { code: room.gameState.currentWeatherCode });
        io.to(roomCode).emit("startNextLevel", {
            currentLevel: room.gameState.currentLevel,
            levelTime: room.gameState.levelTime
        });

        startWaveSpawnerForLevel(roomCode, room.gameState.currentLevel);
        startLevelTimer(roomCode);
    }, 8000);
}



// --- BITCOIN PRICE ---
async function fetchBtcPrice() {
    try {
        const res = await fetch("https://data-api.coindesk.com/index/cc/v1/latest/tick?market=ccix&instruments=BTC-USD");
        const json = await res.json();
        const value = json.Data?.["BTC-USD"]?.VALUE;
        if (value) {
            btcPrice = parseFloat(value);
            console.log("₿ BTC/USD:", btcPrice);
        } else {
            console.warn("BTC value not found in response.");
        }
    } catch (err) {
        console.warn("BTC fetch failed:", err.message);
    }
}

// -- WEATHER SYSTEM --

function generateWeatherCode(level) {
    // Weighted weather roll
    const clearCodes = [0, 1, 2];
    const fogCodes = [45];
    const rainCodes = [51, 61, 63];
    const snowCodes = [75, 77];
    const stormCodes = [95, 99];
    const overcast = [3, 4, 5];

    if (level % 5 === 0) {
        return getRandom([0, 77, 95]); // clear, snow, storm on milestone levels
    }

    const options = [
        ...clearCodes, ...overcast,
        ...fogCodes, ...rainCodes,
        ...snowCodes, ...stormCodes
    ];

    return options[Math.floor(Math.random() * options.length)];
}

function getRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// --- SPAWN LOOP ---

function startWaveSpawnerForLevel(roomCode, level) {
    const room = rooms[roomCode];
    if (!room) return;

    if (room.gameState.waveSpawnInterval) {
        clearInterval(room.gameState.waveSpawnInterval);
    }

    const delay = Math.max(2000, 10000 - level * 1000);
    console.log(`[SPAWN LOOP] Interval set to ${delay}ms for level ${level} in room ${roomCode}`);

    // Spawn first wave
    dynamicEnemySpawn(roomCode);

    room.gameState.waveSpawnInterval = setInterval(() => {
        if (!rooms[roomCode] || room.gameState.stopLoop) {
            console.log("[SPAWN LOOP] Stop loop active. Not spawning.");
            return;
        }
        dynamicEnemySpawn(roomCode);
    }, delay);
}

// -- Mystery Crystals --

function spawnMysteryCrystal(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    const id = crypto.randomUUID();
    const tile = getRandomValidTile();
    const { x, y } = tile;
    const crystal = { id, x, y };

    room.gameState.mysteryCrystals.push(crystal);
    console.log(`Spawning mystery crystal in room ${roomCode}`);
    io.to(roomCode).emit("mysteryCrystalSpawn", crystal);
}

function startMysteryCrystalSpawner(roomCode) {
    const room = rooms[roomCode];
    if (!room) return;

    const initialInterval = 50000;
    const minInterval = 20000;
    const duration = 4 * 60 * 1000;
    let startTime = Date.now();

    async function loop() {
        if (!rooms[roomCode] || room.gameState.stopLoop) return;

        spawnMysteryCrystal(roomCode);

        const elapsed = Date.now() - startTime;
        const nextDelay = Math.max(
            minInterval,
            initialInterval - ((initialInterval - minInterval) * (elapsed / duration))
        );

        setTimeout(loop, nextDelay);
    }

    loop();
}

// -- Blood Crystals --
function spawnBloodCrystal(roomCode, x, y, type) {
    const room = rooms[roomCode];
    if (!room) return;

    const id = crypto.randomUUID();
    const crystal = { id, x, y, type: capitalizeFirstLetter(type) };

    room.gameState.bloodCrystals.push(crystal);
    console.log(`Spawning blood crystal in room ${roomCode}`);
    io.to(roomCode).emit("bloodCrystalSpawn", crystal);
}


function capitalizeFirstLetter(val) {
    return String(val).charAt(0).toUpperCase() + String(val).slice(1);
}

function getEffectLabel(effect) {
    switch (effect) {
        case 'massiveHeal': return 'Massive Heal!';
        case 'invincibility': return 'Invincibility!';
        case 'speedFrenzy': return 'Speed++';
        case 'multiAoE': return 'AoE Blast!';
        case 'clearEnemies': return 'Enemies Cleared!';
        case 'hpDrop': return 'HP -2';
        case 'speedLoss': return 'Speed--';
        case 'freezePlayer': return 'Freeze';
        case 'flipControls': return 'Controls Flipped!';
        case 'enemyWave': return 'Enemy Wave!';
        case "gainSwap": return 'Swap Power!';
        default: return 'Mystery!';
    }
}

// -- Update loop --
let lastTime = Date.now();
let worst = 0;
setInterval(() => {
    const now = Date.now();
    const delta = now - lastTime;
    lastTime = now;

    Object.keys(rooms).forEach(roomCode => {
        const room = rooms[roomCode];
        if (room && room.gameState && !room.gameState.stopLoop) {
            updateEnemiesForRoom(roomCode, delta, now);
        }
    });
}, 100);

// Serve static assets built by Vite into /dist
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// SPA fallback — return index.html for any route (so Phaser single-page works)
app.get(/.*/, (_req, res) => res.sendFile(path.join(__dirname, "dist", "index.html")));



server.listen(3000, () => {
    console.log('Multiplayer server running on http://localhost:3000');
});