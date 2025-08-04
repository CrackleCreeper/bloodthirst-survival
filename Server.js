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
const readyPlayers = new Set();
let currentWeather = null;
let currentWeatherCode = null;
let mysteryCrystals = []; // [{id, x, y, type}]

let currentLevel = 1;
let levelTime = 30; // in seconds
let levelStartTime = Date.now();
let levelInterval = null;
let waveSpawnInterval = null;
let stopLoop = false;


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

const ATTACK_RANGE = 45;   // forward reach in px
const ATTACK_WIDTH = 36;   // blade/swing width in px (side-to-side)
const ATTACK_COOLDOWN_MS = 350; // server-side guard (matches/close to client animation)
const PLAYER_HALF = 16;

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
            stopLoop = false;
            startWaveSpawnerForLevel(io, currentLevel);

            startLevelTimer(io); // ✅ Add this
            startMysteryCrystalSpawner();
            spawnLoopStarted = true;

            // currentWeatherCode = generateWeatherCode(currentLevel);
            // io.emit("weatherUpdate", { code: currentWeatherCode });
        }
    });
    socket.on("playerReady", () => {
        console.log(`${socket.id} is ready`);
        readyPlayers.add(socket.id);

        if (readyPlayers.size === activePlayers.size) {
            console.log("✅ All players are ready. Restarting game.");

            // Full reset
            backendEnemies = {};
            backendPlayers = {};
            currentLevel = 1;
            levelTime = 30;
            stopLoop = false;
            spawnLoopStarted = false;

            // Reset all ready flags
            readyPlayers.clear();

            // Emit restart signal
            io.emit("restartGame");

            // Restart game loop
            for (const id of activePlayers) {
                backendPlayers[id] = {
                    id,
                    x: 400,
                    y: 200,
                    hp: 5,
                    attackMultiplier: 1,
                    isAttacking: false,
                    invulnerable: false,
                    isFrozen: false,
                };
            }

            io.emit("updatePlayers", backendPlayers);

            startWaveSpawnerForLevel(io, currentLevel);
            startLevelTimer(io);
        }
    });



    socket.on("readyForPlayers", () => {
        socket.emit("updatePlayers", backendPlayers);
        socket.broadcast.emit("updatePlayers", backendPlayers);
        socket.emit("weatherUpdate", { code: currentWeatherCode });
        socket.emit("startNextLevel", { currentLevel, levelTime });
    });

    socket.on('joinGame', (playerData) => {
        backendPlayers[socket.id] = {
            id: socket.id,
            x: playerData.x,
            y: playerData.y,
            hp: 5,
            isDead: false,
            direction: 'down',
        };

        // 1️⃣ Send the new player all existing players
        socket.emit('currentPlayers', backendPlayers);

        // 2️⃣ Notify all others about this new player
        socket.broadcast.emit('playerJoined', backendPlayers[socket.id]);

        console.log(`Player joined: ${socket.id}`);
    });

    socket.on("aoeBlast", ({ x, y, radius }) => {
        const player = backendPlayers[socket.id];
        if (!player || player.isDead) return;

        console.log(`[Server] AoE from ${socket.id} at (${x}, ${y})`);

        for (const enemy of Object.values(backendEnemies)) {
            const dist = Math.hypot(enemy.x - x, enemy.y - y);
            if (dist <= radius && !enemy.isDead) {
                const died = applyDamageToEnemy(enemy, 3);// keep your existing usage

                if (!died) {
                    io.emit("enemyHit", { id: enemy.id, hp: enemy.hp });
                }

                if (died) {
                    // broadcast to all so their puppet gets destroyed
                    io.emit("enemyKilled", { id: enemy.id });
                    delete backendEnemies[enemy.id];
                }
            }
        }
    });





    socket.on("disconnect", (reason) => {
        console.log(`Player disconnected: ${socket.id}`);
        activePlayers.delete(socket.id);
        delete backendPlayers[socket.id];
        io.emit("updatePlayers", backendPlayers);

        // Optional: treat any disconnect as game over
        stopLoop = true;
        console.log(`[GAME OVER] Player ${socket.id} disconnected. Ending game.`);
        stopAllTimersAndWaves();
        backendEnemies = {};
        currentLevel = 1;
        levelTime = 30;


        io.emit("gameOver");
    });


    socket.on("playerMoved", (data) => {
        if (backendPlayers[data.playerId]) {
            Object.assign(backendPlayers[data.playerId], {
                x: data.x,
                y: data.y,
                isMoving: data.isMoving,
                direction: data.direction,
                lastAttackAt: 0,        // <-- add this
            });
        }
        socket.broadcast.emit("playerMoved", data);
    });

    socket.on("playerDied", () => {
        const player = backendPlayers[socket.id];
        stopLoop = true;
        if (player) player.isDead = true;

        console.log(`[GAME OVER] Player ${socket.id} died. Ending game for all players.`);
        stopAllTimersAndWaves();
        backendEnemies = {};
        backendPlayers = {};
        currentLevel = 1;
        levelTime = 30;
        spawnLoopStarted = false;

        socket.broadcast.emit("removePlayer", socket.id);
        io.emit("gameOver");

    });

    socket.on("lightningStrikeRequest", ({ x, y }) => {
        const radius = 50;

        for (const playerId in backendPlayers) {
            const p = backendPlayers[playerId];
            const dist = Math.hypot(p.x - x, p.y - y);
            if (dist < radius && !p.invulnerable) {
                p.hp -= 2;
                if (p.hp <= 0) {
                    console.log(`Enemy killed a player.`)
                    p.isDead = true;
                    io.emit("playerDied");

                }
            }
        }

        for (const enemyId in backendEnemies) {
            const e = backendEnemies[enemyId];
            const dist = Math.hypot(e.x - x, e.y - y);
            if (dist < radius) {
                const died = applyDamageToEnemy(e, 2);// keep your existing usage

                if (!died) {
                    io.emit("enemyHit", { id: e.id, hp: e.hp });
                }

                if (died) {
                    // broadcast to all so their puppet gets destroyed
                    io.emit("enemyKilled", { id: e.id });
                    delete backendEnemies[e.id];
                }
            }
        }

        io.emit("lightningStrike", { x, y }); // optional visual sync
    });

    socket.on("collectMysteryCrystal", ({ crystalId }) => {
        const player = backendPlayers[socket.id];

        const crystal = mysteryCrystals.find(c => c.id === crystalId);


        if (!player || !crystal) return;

        // Remove the crystal from server
        mysteryCrystals = mysteryCrystals.filter(c => c.id !== crystalId);

        io.emit("mysteryCrystalCollected", { crystalId });

        const positive = ['massiveHeal', 'invincibility', 'speedFrenzy', 'multiAoE', 'clearEnemies'];
        const negative = ['hpDrop', 'speedLoss', 'enemyWave', 'freezePlayer', 'flipControls'];

        const isPositive = Math.random() < 0.5;
        const effect = isPositive
            ? positive[Math.floor(Math.random() * positive.length)]
            : negative[Math.floor(Math.random() * negative.length)];

        // Collector gets full effect
        socket.emit("applyMysteryEffect", { playerId: socket.id, effect });

        // Everyone else gets visual only
        socket.broadcast.emit("applyMysteryEffect", { playerId: socket.id, effect });


        // Optionally broadcast if the effect affects everyone
        if (effect === 'clearEnemies') {
            for (const id in backendEnemies) {
                const e = backendEnemies[id];
                if (!e.isDead) {
                    e.isDead = true;
                    io.emit("enemyKilled", { id });
                }
            }
        } else if (effect === 'enemyWave') {
            dynamicEnemySpawn();
            dynamicEnemySpawn(); // spawn 2 waves
        }

        // Trigger backend logic like enemy spawning here if needed
        socket.broadcast.emit("mysteryEffectVisual", {
            x: player.x,
            y: player.y,
            text: getEffectLabel(effect),
            color: isPositive ? "#00ff00" : "#ff0000"
        });

    });



    socket.on("playerAttack", ({ playerId, direction }) => {
        const pl = backendPlayers[playerId];
        if (!pl) return;

        // Server-side cooldown guard
        const now = Date.now();
        if (now - (pl.lastAttackAt || 0) < ATTACK_COOLDOWN_MS) {
            // still broadcast the animation so the attacker sees it in sync
            socket.broadcast.emit("playerAttack", { playerId, direction });
            return;
        }
        pl.lastAttackAt = now;

        // (Optional) trust the passed direction or force to server-known direction
        const face = direction || pl.direction || 'down';

        // Find all enemies inside the melee oriented-rect
        const hits = [];
        for (const id in backendEnemies) {
            const e = backendEnemies[id];
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
                io.emit("enemyHit", { id: e.id, hp: e.hp });
            }

            if (died) {
                // broadcast to all so their puppet gets destroyed
                io.emit("enemyKilled", { id: e.id });
                delete backendEnemies[e.id];
            }
        }



        // Still broadcast the attack animation to OTHER clients
        socket.broadcast.emit("playerAttack", { playerId, direction: face });
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
    if (stopLoop) {
        console.log("[SPAWN BLOCKED] Game stopped, no enemy spawned.");
        return;
    }
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

function stopAllTimersAndWaves() {
    clearInterval(levelInterval);
    clearInterval(waveSpawnInterval);
    levelInterval = null;
    waveSpawnInterval = null;
    stopLoop = true;
    spawnLoopStarted = false;
    console.log("[Cleanup] levelInterval =", levelInterval);
    console.log("[Cleanup] waveSpawnInterval =", waveSpawnInterval);

    console.log("[✔] Timers and enemy spawns stopped.");
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

function startLevelTimer(io) {
    if (stopLoop) {
        console.log("[startLevelTimer] Loop stopped. Not starting timer.");
        return;
    }
    levelStartTime = Date.now();
    levelInterval = setInterval(() => {
        if (stopLoop) {
            clearInterval(levelInterval);
            levelInterval = null;
            return;
        }
        const elapsed = Math.floor((Date.now() - levelStartTime) / 1000);
        const remaining = Math.max(0, levelTime - elapsed);

        io.emit("levelTimerUpdate", { remaining, currentLevel });

        if (remaining <= 0) {
            clearInterval(levelInterval);
            levelInterval = null;
            nextLevel(io);
        }
    }, 1000);
}


function nextLevel(io) {
    currentLevel++;
    levelTime += 10;

    // Notify clients
    io.emit("levelComplete", { currentLevel });

    // Clear enemies
    // Broadcast kill signals to all enemies
    for (const id in backendEnemies) {
        const enemy = backendEnemies[id];
        if (!enemy.isDead) {
            enemy.isDead = true;
            io.emit("enemyKilled", { id }); // Trigger client animation
        }
    }

    // Wait ~2 seconds before clearing them from backend
    setTimeout(() => {
        backendEnemies = {};
    }, 2000);
    clearInterval(waveSpawnInterval);

    // Delay before starting next level
    setTimeout(() => {
        if (stopLoop) {
            console.log("[SPAWN LOOP] Stop loop active. Not spawning.");
            clearInterval(waveSpawnInterval);
            return;
        }
        currentWeatherCode = generateWeatherCode(currentLevel);
        io.emit("weatherUpdate", { code: currentWeatherCode });
        io.emit("startNextLevel", { currentLevel, levelTime });
        startWaveSpawnerForLevel(io, currentLevel);
        // your own enemy logic here
        startLevelTimer(io);
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
async function startWaveLoop() {
    await fetchBtcPrice();
    dynamicEnemySpawn();
    currentLevel++;

    const delay = Math.max(10000 - currentLevel * 500, 4000);
    setTimeout(startWaveLoop, delay);
}

function startWaveSpawnerForLevel(io, level) {
    if (waveSpawnInterval) clearInterval(waveSpawnInterval);

    const delay = Math.max(2000, 10000 - level * 1000); // Match singleplayer
    console.log(`[SPAWN LOOP] Interval set to ${delay}ms for level ${level}`);

    // Spawn the first wave instantly, like in singleplayer
    dynamicEnemySpawn(io);

    waveSpawnInterval = setInterval(() => {
        if (stopLoop) {
            console.log("[SPAWN LOOP] Stop loop active. Not spawning.");
            return;
        }
        if (activePlayers.size === 0) return;
        dynamicEnemySpawn();
    }, delay);
}

// -- Mystery Crystals --

function spawnMysteryCrystal() {
    const id = crypto.randomUUID(); // or any unique ID generator
    const tile = getRandomValidTile();
    const { x, y } = tile;
    const crystal = { id, x, y };
    mysteryCrystals.push(crystal);
    console.log("Spawning")
    io.emit("mysteryCrystalSpawn", crystal);
}

function startMysteryCrystalSpawner() {
    const initialInterval = 50000; // 50 seconds
    const minInterval = 20000;     // never below 20s
    const duration = 4 * 60 * 1000; // 4 minutes ramp
    let startTime = Date.now();

    async function loop() {
        if (stopLoop) return;

        spawnMysteryCrystal();

        const elapsed = Date.now() - startTime;
        const nextDelay = Math.max(
            minInterval,
            initialInterval - ((initialInterval - minInterval) * (elapsed / duration))
        );

        setTimeout(loop, nextDelay);
    }

    loop(); // start the loop
}


function getRandomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
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
    if (stopLoop) return;

    // update enemies
    const t0 = Date.now();
    const elapsed = Math.floor((now - levelStartTime) / 1000);
    const timeLeft = Math.max(0, levelTime - elapsed);
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
