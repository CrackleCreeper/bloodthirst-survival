import EasyStar from "easystarjs";
// TODO: Add the enemy taking damage and dying part.
export class ServerEnemy {
    constructor(id, x, y, type = "vampire1", mapGrid, tileSize, hooks = {}) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.gridX = Math.floor(x / tileSize);
        this.gridY = Math.floor(y / tileSize);
        this.type = type.toLowerCase();

        this.hp = (this.type == "vampire1") ? 2 : ((this.type == "vampire2") ? 1 : 4);
        this.baseChaseSpeed = (this.type == "vampire1") ? 50 : ((this.type == "vampire2") ? 140 : 40);
        this.targetPlayerId = null;

        this.stuckCounter = 0;
        this.lastPosition = { x: this.x, y: this.y };

        this.easystar = new EasyStar.js();
        this.easystar.setGrid(mapGrid); // 2D grid array
        this.easystar.setAcceptableTiles([0]); // assuming 0 = walkable

        this.path = null;
        this.nextMoveTime = 0;
        this.pathStep = 0;

        this.tileSize = tileSize;

        this.attackRange = 22;
        this.attackDamage = 1;
        this.lastAttackTime = 0;
        this.animationLockUntil = 0;

        this.attackCooldown = 1000;
        this.mapGrid = mapGrid; // Add this line
        this.easystar.setGrid(mapGrid);
        this.easystar.setIterationsPerCalculation(100); // was 300

        // Animation properties
        this.facing = 'down'; // default facing direction
        this.currentAnim = `${this.type}_idle_down`; // default idle anim
        this.state = 'idle'; // track "idle", "walk", "run", "attack"

        // --- Wander + jitter fields ---
        this.wanderTarget = null;
        this.nextWanderTime = 0;
        this.wanderSpeed = Math.max(20, Math.floor(this.baseChaseSpeed * 0.5));
        this.baseWanderSpeed = 20
        this.chaseSpeed = this.baseChaseSpeed;
        this.repathJitter = Math.floor(Math.random() * 400); // was 250
        this.lastTarget = { x: -1, y: -1 };                  // track last path target
        this.detectionRadius = 350;


        // memory of last seen player
        this.lastSeenAt = -Infinity;   // timestamp (ms) when LOS was last true
        this.memoryMs = 2000;          // how long to “remember” after losing LOS
        this.lastSeenPos = { x: this.x, y: this.y }; // last known player world pos
        this.pendingPath = false;     // are we waiting for EasyStar callback?
        this.pathRequestedAt = 0;     // last request time (ms) to throttle

        // Hooks
        this.onHit = hooks.onHit || (() => { });
        this.onDeath = hooks.onDeath || (() => { });


    }

    update(deltaTime, currentTime, players) {
        const isAnimationLocked = currentTime < this.animationLockUntil;

        // Attack animation lock: freeze only THIS enemy
        if (isAnimationLocked && this.state === 'attack') {
            this.currentAnim = `${this.type}_attack_${this.facing}`;
            this.lastPosition = { x: this.x, y: this.y };
            return;
        }
        if (!isAnimationLocked && this.state === 'attack') {
            this.state = 'idle';
            this.currentAnim = `${this.type}_idle_${this.facing}`;
            this.lastTarget = { x: -1, y: -1 };
            this.nextMoveTime = 0; // repath ASAP if needed
        }

        // Choose closest alive player
        const playerList = Object.values(players).filter(p => !p.isDead);
        if (playerList.length === 0) {
            // No alive players → clear chase intent and wander (or set idle)
            this.targetPlayerId = null;
            this.path = null;
            this.pathStep = 0;
            this.lastTarget = { x: -1, y: -1 };

            // keep them active visually
            this.updateWander(deltaTime, currentTime);

            // still do bookkeeping so stuck logic works
            const movedAmt = Math.abs(this.x - this.lastPosition.x) + Math.abs(this.y - this.lastPosition.y);
            if (movedAmt < 0.5) this.stuckCounter += deltaTime; else this.stuckCounter = 0;
            if (this.stuckCounter > 2000) { this.nudgeToOpenTile(); this.stuckCounter = 0; }
            this.lastPosition = { x: this.x, y: this.y };

            return; // now it’s safe to return
        }

        let closest = null, minDist = Infinity;
        for (const p of playerList) {
            const d = Math.hypot(p.x - this.x, p.y - this.y);
            if (d < minDist) { minDist = d; closest = p; }
        }
        if (!closest) { this.updateWander(deltaTime, currentTime); return; }

        this.targetPlayerId = closest.id;
        if (minDist > this.detectionRadius) {
            this.updateWander(deltaTime, currentTime);
            return;
        }
        // LOS + memory
        const targetX = Math.floor(closest.x / this.tileSize);
        const targetY = Math.floor(closest.y / this.tileSize);
        const hasLOS = this.hasLineOfSightTo(targetX, targetY);

        // record last seen *before* computing inMemory
        if (hasLOS) {
            this.lastSeenAt = currentTime;
            this.lastSeenPos = { x: closest.x, y: closest.y };
        }


        const inMemory = (currentTime - this.lastSeenAt) < this.memoryMs;

        if (hasLOS && minDist < this.detectionRadius) {
            // ===== A) DIRECT CHASE — no pathfinding
            this.wanderTarget = null;
            this.path = null;
            this.pathStep = 0;

            const dx = closest.x - this.x;
            const dy = closest.y - this.y;
            const dist = Math.hypot(dx, dy);
            if (dist > 0.001) {
                const vx = (dx / dist) * this.chaseSpeed * (deltaTime / 1000);
                const vy = (dy / dist) * this.chaseSpeed * (deltaTime / 1000);
                this.x += vx; this.y += vy;

                this.gridX = Math.floor(this.x / this.tileSize);
                this.gridY = Math.floor(this.y / this.tileSize);
                this.updateAnimationDirection(dx, dy);

                this.state = (dist < 5 * this.tileSize) ? 'run' : 'walk';
                this.currentAnim = `${this.type}_${this.state}_${this.facing}`;
            }

        } else if (inMemory) {
            // ===== B) MEMORY CHASE — pathfind to lastSeenPos
            this.wanderTarget = null;

            const memTargetX = Math.floor(this.lastSeenPos.x / this.tileSize);
            const memTargetY = Math.floor(this.lastSeenPos.y / this.tileSize);

            if (!this.pendingPath &&
                (memTargetX !== this.lastTarget.x ||
                    memTargetY !== this.lastTarget.y ||
                    currentTime > this.nextMoveTime)) {
                this.pendingPath = true;
                this.lastTarget = { x: memTargetX, y: memTargetY };
                this.pathRequestedAt = currentTime;
                this.nextMoveTime = currentTime + 400 + Math.floor(Math.random() * 200) + this.repathJitter;

                this.easystar.findPath(this.gridX, this.gridY, memTargetX, memTargetY, (path) => {
                    this.pendingPath = false;
                    if (path && path.length > 1) {
                        this.path = path;
                        this.pathStep = 1;
                    } else if (!this.path || this.pathStep >= (this.path?.length || 0)) {
                        this.path = null;
                        this.pathStep = 0;
                    }
                });
            }

            // Only run EasyStar while in memory-chase
            this.easystar.calculate();

            if (this.path && this.pathStep < this.path.length) {
                const nextTile = this.path[this.pathStep];
                const tx = nextTile.x * this.tileSize + this.tileSize / 2;
                const ty = nextTile.y * this.tileSize + this.tileSize / 2;

                const dx = tx - this.x;
                const dy = ty - this.y;
                const dist = Math.hypot(dx, dy);

                if (dist < 4) {
                    this.gridX = nextTile.x; this.gridY = nextTile.y;
                    this.x = tx; this.y = ty;
                    this.pathStep++;
                    if (this.pathStep >= this.path.length) {
                        // Reached last known spot
                        this.state = 'idle';
                        this.currentAnim = `${this.type}_idle_${this.facing}`;
                    }
                } else {
                    const vx = (dx / dist) * this.chaseSpeed * (deltaTime / 1000);
                    const vy = (dy / dist) * this.chaseSpeed * (deltaTime / 1000);
                    this.x += vx; this.y += vy;

                    this.gridX = Math.floor(this.x / this.tileSize);
                    this.gridY = Math.floor(this.y / this.tileSize);
                    this.updateAnimationDirection(dx, dy);

                    this.state = (dist < 5 * this.tileSize) ? 'run' : 'walk';
                    this.currentAnim = `${this.type}_${this.state}_${this.facing}`;
                }
            } else {
                // Waiting for path slices — do a short wander step so they don’t look frozen
                this.updateWander(deltaTime, currentTime);
            }

        } else {
            // ===== C) WANDER
            this.path = null;
            this.pathStep = 0;
            this.lastTarget = { x: -1, y: -1 };
            this.updateWander(deltaTime, currentTime);
        }

        // ===== Unstuck + bookkeeping =====
        const movedAmt = Math.abs(this.x - this.lastPosition.x) + Math.abs(this.y - this.lastPosition.y);
        if (movedAmt < 0.5) this.stuckCounter += deltaTime; else this.stuckCounter = 0;
        if (this.stuckCounter > 2000) { this.nudgeToOpenTile(); this.stuckCounter = 0; }
        this.lastPosition = { x: this.x, y: this.y };

        // ===== Attack check (common to all movement branches) =====
        const targetPlayer = players[this.targetPlayerId];
        if (!targetPlayer || targetPlayer.isDead) {
            // optional: drop target so we re-pick next frame
            this.targetPlayerId = null;
        } else {
            if (targetPlayer && !targetPlayer.isDead) {
                const hitDist = Math.hypot(targetPlayer.x - this.x, targetPlayer.y - this.y);
                if (hitDist < this.attackRange && currentTime > this.lastAttackTime + this.attackCooldown) {
                    this.lastAttackTime = currentTime;
                    this.animationLockUntil = currentTime + 300;
                    this.state = 'attack';
                    this.currentAnim = `${this.type}_attack_${this.facing}`;

                    if (typeof targetPlayer.takeDamage === 'function') targetPlayer.takeDamage(this.attackDamage);
                    else {
                        targetPlayer.hp -= this.attackDamage;
                        this.onHit(targetPlayer.id, {
                            hp: targetPlayer.hp,
                            knockback: { x: targetPlayer.x - this.x, y: targetPlayer.y - this.y }
                        });

                        if (targetPlayer.hp <= 0) {
                            console.log(`Enemy killed a player.`)
                            targetPlayer.isDead = true;
                            this.onDeath(targetPlayer.id);
                        }
                    }

                    // (optional) drop path so we’ll repath next tick if needed
                    this.lastTarget = { x: -1, y: -1 };
                    this.nextMoveTime = 0;
                    // this.wanderTarget = null;
                }
            }
        }
    }


    nudgeToOpenTile() {
        const offsets = [[0, -1], [1, 0], [0, 1], [-1, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]];
        for (let [dx, dy] of offsets) {
            const nx = this.gridX + dx;
            const ny = this.gridY + dy;
            if (ny >= 0 && ny < this.mapGrid.length &&
                nx >= 0 && nx < this.mapGrid[0].length &&
                this.mapGrid[ny][nx] === 0) {
                this.gridX = nx;
                this.gridY = ny;
                this.x = nx * this.tileSize + this.tileSize / 2;
                this.y = ny * this.tileSize + this.tileSize / 2;

                // add:
                this.path = null;
                this.pathStep = 0;
                this.lastTarget = { x: -1, y: -1 };
                this.nextMoveTime = 0;
                this.wanderTarget = null; // add this line to your nudge method

                break;
            }
        }
    }



    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.isDead = true;
            this.currentAnim = `${this.type.toLowerCase()}_death`;
        }
    }

    getData() {
        return {
            id: this.id,
            type: this.type,
            x: this.x,
            y: this.y,
            facing: this.facing,
            anim: this.currentAnim,
            health: this.hp,
        };
    }


    updateAnimationDirection(dx, dy) {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (absDx > absDy) {
            this.facing = dx > 0 ? 'right' : 'left';
        } else {
            this.facing = dy > 0 ? 'down' : 'up';
        }
    }


    hasLineOfSightTo(targetX, targetY) {
        const line = this.getLine(this.gridX, this.gridY, targetX, targetY);
        for (let i = 1; i < line.length - 1; i++) { // skip start & end tiles
            const { x, y } = line[i];
            if (y < 0 || y >= this.mapGrid.length || x < 0 || x >= this.mapGrid[0].length) return false;
            if (this.mapGrid[y][x] !== 0) return false;
        }
        return true;
    }



    // Bresenham’s line algorithm
    getLine(x0, y0, x1, y1) {
        const points = [];
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;

        while (true) {
            points.push({ x: x0, y: y0 });
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                x0 += sx;
            }
            if (e2 < dx) {
                err += dx;
                y0 += sy;
            }
        }

        return points;
    }

    pickWanderStep() {
        const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
        // randomize order
        for (let i = dirs.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
        }

        for (const [dx, dy] of dirs) {
            const nx = this.gridX + dx;
            const ny = this.gridY + dy;
            if (
                ny >= 0 && ny < this.mapGrid.length &&
                nx >= 0 && nx < this.mapGrid[0].length &&
                this.mapGrid[ny][nx] === 0
            ) {
                this.wanderTarget = {
                    x: nx * this.tileSize + this.tileSize / 2,
                    y: ny * this.tileSize + this.tileSize / 2,
                };
                return true;
            }
        }
        return false;
    }


    updateWander(deltaTime, currentTime) {
        // if we don’t have a current step or we timed out, pick 1 adjacent step
        if (!this.wanderTarget || currentTime > this.nextWanderTime) {
            if (!this.pickWanderStep()) {
                // nowhere to go -> idle
                this.state = 'idle';
                this.currentAnim = `${this.type}_idle_${this.facing}`;
                return;
            }
            this.nextWanderTime = currentTime + 300 + Math.floor(Math.random() * 200);

        }

        const dx = this.wanderTarget.x - this.x;
        const dy = this.wanderTarget.y - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist < 6) {
            // snapped to center of the neighbor tile
            this.x = this.wanderTarget.x;
            this.y = this.wanderTarget.y;
            this.gridX = Math.floor(this.x / this.tileSize);
            this.gridY = Math.floor(this.y / this.tileSize);
            this.wanderTarget = null; // pick a new neighbor next tick
            this.state = 'idle';
            this.currentAnim = `${this.type}_idle_${this.facing}`;
            return;
        }

        // walk toward the neighbor tile center
        const vx = (dx / dist) * this.wanderSpeed * (deltaTime / 1000);
        const vy = (dy / dist) * this.wanderSpeed * (deltaTime / 1000);
        this.x += vx;
        this.y += vy;

        this.gridX = Math.floor(this.x / this.tileSize);
        this.gridY = Math.floor(this.y / this.tileSize);
        this.updateAnimationDirection(dx, dy);
        this.state = 'walk';
        this.currentAnim = `${this.type}_walk_${this.facing}`;
    }



}
