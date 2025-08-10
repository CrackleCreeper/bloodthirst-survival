# BloodThirst Survival

Survive the arena. Bend the weather. Outlast your friend.

## Overview

BloodThirst Survival is a fast-paced survival arena built with Phaser 3. Fight escalating waves of enemies, harvest Blood Crystals for power-ups, risk Mystery Crystals for temporary buffs or nerfs, and adapt to changing weather that affects your gameplay. Play solo or duel a friend online—win by outlasting them.

## Core Gameplay

- Survival loop
    - Each level requires you to survive a timer.
    - Levels escalate: tougher enemies, denser spawns, longer timers.
- Blood Crystals (enemy drops)
    - Every enemy drops a Blood Crystal.
    - Crystals grant benefits based on the enemy type you killed (e.g., healing, damage boost, speed, AoE, etc.).
- Mystery Crystals (random spawns)
    - Periodically spawn with increasing frequency at higher levels.
    - Grant temporary randomized effects:
        - Buffs (e.g., speed burst, damage amp, shield)
        - Nerfs (e.g., reduced speed, inverted controls, vulnerability)
- Dynamic Weather
    - Arena weather changes at intervals and affects movement/controls.
    - Example: Rain can make you slip or drift unpredictably.
    - Weather frequency/effects scale with levels.


## Multiplayer Mode

- Room-based matchmaking
    - Create a room and share the room code with a friend.
    - Both players ready up to start.
- Victory condition
    - Same mechanics as single-player, but you win if your opponent dies first.
- Swap mechanic (mind games!)
    - Collect a Mystery Crystal for a 40% chance to gain a “Swap.”
    - Press P to swap positions with your opponent.
    - Use swaps to escape danger or drop your opponent into chaos.
    - Swaps are stored (bank them for clutch moments).


## Current Features

- Single-player and 1v1 multiplayer survival
- Blood Crystal power-ups tied to enemy type
- Mystery Crystal temporary buffs/nerfs
- Dynamic weather system with gameplay effects
- Room code-based multiplayer with ready-up
- GameOver flow with restart synchronization
- Safe scene/lifecycle handling to prevent socket/memory leaks


## Planned / Future Features

- Multiple arenas and Arena selection screen
- Scoring system: earn Blood Points for survival time and kills
- Meta-progression: unlock arenas with Blood Points
- Boss levels: defeat a boss to clear specific arenas
- Cosmetics: unlockable character skins and trail effects
- Co-op mode: survive together vs. time; maybe a revive mechanic.


## Controls

- Movement: WASD
- Attack/Action: Space
- Swap (Multiplayer): P (if you have swaps)
- Restart (Game Over): R
- Main Menu (Game Over): M


## Tech Stack

- Game Engine: Phaser 3.90 
- Runtime: Node.js
- Multiplayer: Socket.IO (same-origin in production)
- Build Tool: Vite
- Server: Express
- Language: JavaScript
- Package Manager: npm
- Map made using: Tiled


## Setup (Local Development)

Requirements:

- Node 18+ (tested on Node 22)
- npm 9+

Install:

- `npm install`


## Production Build \& Run (Single Process)

Recommended: Serve the built client from Express and host Socket.IO on the same origin.

Build:

- `npm run build`

Start:

- `npm start`

This will:

- Serve `dist/` at `/`
- Serve Socket.IO on the same origin (`/socket.io`)


## How to Play (Quick)

- Single-player: Start Game → Survive the timer each level → Collect Blood Crystals → Adapt to weather → Advance.
- Multiplayer: Create Room → Share Room Code → Both Ready → Outlast your friend → Collect swaps and press `P` to flip positions.


## Deployment

- Build: `npm run build`
- Start: `npm start`


## Credits

- Phaser community and docs
- Player Sprite : https://xzany.itch.io/top-down-adventurer-character
- Map: https://cainos.itch.io/pixel-art-top-down-basic
- Enemies: https://free-game-assets.itch.io/free-vampire-4-direction-pixel-character-sprite-pack
- Map Editor: https://thorbjorn.itch.io/tiled
- Sound Effects from: https://www.zapsplat.com/ , https://pixabay.com/ , https://mixkit.co/ , https://mixkit.co/ 


***

