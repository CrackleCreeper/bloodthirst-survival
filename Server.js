import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import fs from 'fs';
import cors from 'cors';
import fetch from 'node-fetch'; // ensure this is installed
import { ServerEnemy } from "./src/Classes/ServerEnemy.js"; // Adjust the import path as necessary
const TILE_SIZE = 32;
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});

app.use(cors({ origin: 'http://localhost:5173' }));

// State
let backendPlayers = {};
let backendEnemies = {};
let currentLevel = 1;
let enemyIdCounter = 0;
let btcPrice = 30000; // fallback default
const activePlayers = new Set();
let spawnLoopStarted = false;

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

// --- SOCKET EVENTS ---
io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}`);
    backendPlayers[socket.id] = {
        id: socket.id, x: 400, y: 200, hp: 5,
        attackMultiplier: 1,
        isAttacking: false,
        invulnerable: false,
        isFrozen: false,
    };

    socket.on("player-joined", () => {
        activePlayers.add(socket.id);
        console.log("Active players:", activePlayers.size);

        if (!spawnLoopStarted) {
            startWaveLoop();  // <-- Only starts once
            spawnLoopStarted = true;
        }
    });

    socket.on("readyForPlayers", () => {
        socket.emit("updatePlayers", backendPlayers);
        socket.broadcast.emit("updatePlayers", backendPlayers);
    });

    socket.on("disconnect", (reason) => {
        console.log(`Player disconnected: ${socket.id}`);
        activePlayers.delete(socket.id);
        delete backendPlayers[socket.id];
        io.emit("updatePlayers", backendPlayers);
    });

    socket.on("playerMoved", (data) => {
        if (backendPlayers[data.playerId]) {
            Object.assign(backendPlayers[data.playerId], {
                x: data.x,
                y: data.y,
                isMoving: data.isMoving,
                direction: data.direction
            });
        }
        socket.broadcast.emit("playerMoved", data);
    });

    socket.on("playerAttack", ({ playerId, direction }) => {
        socket.broadcast.emit("playerAttack", { playerId, direction });
    });
});

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

function dynamicEnemySpawn() {
    const extraEnemies = Math.floor(btcPrice / 10000);
    const spawnCount = 1 + extraEnemies;

    for (let i = 0; i < spawnCount; i++) {
        const type = getRandomEnemyType(currentLevel);
        const tile = getRandomValidTile();
        if (!tile) continue;

        const enemyId = generateUniqueEnemyId();
        const stats = getEnemyStats(type);

        backendEnemies[enemyId] = new ServerEnemy(
            enemyId,
            tile.x,
            tile.y,
            type,
            walkGrid, // mapGrid
            TILE_SIZE,
            {
                onHit: (playerId, payload) => io.to(playerId).emit("playerHit", payload),
                onDeath: (playerId) => io.to(playerId).emit("playerDied")
            }
        );

        io.emit("spawnEnemy", backendEnemies[enemyId].getData());

    }

    console.log(`Spawned ${spawnCount} enemies at level ${currentLevel}`);
}


function updateEnemies(deltaTime, currentTime, players) {

    // every ~1s
    // if (Math.random() < 0.02) {
    //     const counts = { chaseLOS: 0, chaseMem: 0, wander: 0, attack: 0 };
    //     for (const id in backendEnemies) {
    //         const e = backendEnemies[id];
    //         if (e.state === 'attack') counts.attack++;
    //         else if (e.lastSeenAt > 0 && Date.now() - e.lastSeenAt < e.memoryMs && !e.hasLineOfSightTo(
    //             Math.floor(backendPlayers[e.targetPlayerId]?.x / e.tileSize || 0),
    //             Math.floor(backendPlayers[e.targetPlayerId]?.y / e.tileSize || 0)
    //         )) counts.chaseMem++;
    //         else if (e.targetPlayerId && e.hasLineOfSightTo(
    //             Math.floor(backendPlayers[e.targetPlayerId]?.x / e.tileSize || 0),
    //             Math.floor(backendPlayers[e.targetPlayerId]?.y / e.tileSize || 0)
    //         )) counts.chaseLOS++;
    //         else counts.wander++;
    //     }
    //     console.log('[ENEMY STATES]', counts);
    // }

    const start = Date.now();
    let alive = 0;

    for (const id in backendEnemies) {
        const enemy = backendEnemies[id];
        enemy.update(deltaTime, currentTime, players);
        if (enemy.isDead) delete backendEnemies[id];
        else alive++;
    }

    const cost = Date.now() - start;
    if (cost > 30) {
        console.warn(`[TICK] updateEnemies cost=${cost}ms alive=${alive}`);
    }

    io.emit("enemyUpdate", Object.values(backendEnemies).map(e => e.getData()));
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

// --- SPAWN LOOP ---
async function startWaveLoop() {
    await fetchBtcPrice();
    dynamicEnemySpawn();
    currentLevel++;

    const delay = Math.max(10000 - currentLevel * 500, 4000);
    setTimeout(startWaveLoop, delay);
}


// -- Update loop --
let lastTime = Date.now();
let worst = 0;
setInterval(() => {
    const now = Date.now();
    const delta = now - lastTime;
    lastTime = now;

    // update enemies
    const t0 = Date.now();
    updateEnemies(delta, now, backendPlayers);
    const cost = Date.now() - t0;

    worst = Math.max(worst, cost);
    if (cost > 20) { /* 20ms is already big for 10Hz tick */
        // throttle this print too
        if (Math.random() < 0.05) console.warn(`[TICK] cost=${cost}ms (worst=${worst}ms) enemies=${Object.keys(backendEnemies).length}`);
    }
}, 100);





server.listen(3000, () => {
    console.log('Multiplayer server running on http://localhost:3000');
});
