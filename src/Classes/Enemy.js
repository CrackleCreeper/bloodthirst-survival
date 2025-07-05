import EasyStar from "easystarjs";
import Phaser from "phaser";

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, texture, config = {}) {
        super(scene, x, y, texture);

        this.scene = scene;
        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Configurable attributes
        this.hp = config.hp || 3;
        this.speed = config.speed || 50;
        this.type = config.type || 'basic';
        this.map = scene.map;
        this.type = config.type || "Vampire1";
        this.obstacles = scene.obstacles;
        this.enemies = scene.enemies;
        this.scene.physics = scene.physics;
        this.setScale(0.7);
        this.attackCooldown = 0;



        this.path = [];
        this.currentPathIndex = 0;
        this.jiggleCount = 0;
        this.invulnerable = false;
        this.lastMovedTime = 0;
        this.stepTimeout = 0;
        this.isJiggling = false;
        this.lastPos = new Phaser.Math.Vector2(this.x, this.y);
        this.wanderDir = new Phaser.Math.Vector2(0, 0);
        this.nextWanderTime = 0;
        this.wanderTarget = null;
        this.lastSeenPlayerTime = 0;
        this.detectionRadius = 150;
        this.wanderSpeed = 20;
        this.chaseSpeed = 50;
        this.setDamping(true);
        this.setDrag(100);

        // Animations
        this.animPrefix = "vampire1"; // change based on type in future
        this.direction = "down";
        this.currentAnim = null;



        // Pathfinding stuff
        this.finder = new EasyStar.js();
        this.nextPathRecalc = 0;
        const grid = [];

        for (let y = 0; y < this.scene.map.height; y++) {
            const row = [];
            for (let x = 0; x < this.scene.map.width; x++) {
                const tile = this.scene.map.getTileAt(x, y, true, "Collisions");
                row.push(tile.index === -1 ? 0 : 1); // 0 = walkable, 1 = wall
            }
            grid.push(row);
        }

        this.finder.setGrid(grid);
        this.finder.setAcceptableTiles([0]);

        // Physics
        this.setSize(14, 14);
        this.setOffset(0, 0);
        this.setCollideWorldBounds(true);
        this.setBounce(1);
    }

    update(now, player) {
        // You can override this in subclasses
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let typeOfAnim = "walk";

        if (dist < this.detectionRadius && this.hasLineOfSight()) {
            this.seesPlayer = true;
            this.lastSeen = now;
            this.chasePlayer(now, player, dist);
            typeOfAnim = "run";
        } else if (this.seesPlayer && now - this.lastSeen < 2000) {
            this.chasePlayer(now, player, dist);
            typeOfAnim = "run"; // "Memory"
        } else {
            this.seesPlayer = false;
            this.wander(now);
        }

        const vx = this.body.velocity.x;
        const vy = this.body.velocity.y;

        // Determine direction
        const moving = Math.abs(vx) > 2 || Math.abs(vy) > 2;
        if (Math.abs(vx) > Math.abs(vy)) {
            this.direction = vx > 0 ? "right" : "left";
        } else if (Math.abs(vy) > 0) {
            this.direction = vy > 0 ? "down" : "up";
        }

        // Play walk or idle animation
        if (moving) {
            this.playAnim(typeOfAnim);
        } else {
            this.playAnim("idle");
        }


    }

    hasLineOfSight() {
        const line = new Phaser.Geom.Line(this.x, this.y, this.scene.player.x, this.scene.player.y);
        const collisionsLayer = this.scene.map.getLayer("Collisions").tilemapLayer;

        const tiles = collisionsLayer.getTilesWithinShape(line, { isColliding: true });

        return tiles.length === 0; // True if no blocking tiles
    }

    playAnim(state) {
        const key = `${this.animPrefix}_${state}_${this.direction}`;
        if (this.anims.currentAnim?.key !== key) {
            this.anims.play(key, true);
            this.currentAnim = key;
        }
        console.log(`Playing animation: ${key}`);
    }


    drawDebugLines(now, graphics, player) {
        const hasLOS = this.hasLineOfSight();
        const timeSinceSeen = now - this.lastSeenPlayerTime;
        let color;

        if (hasLOS) {
            color = 0x00ff00; // green
        } else if (timeSinceSeen < 2000) {
            color = 0xffff00; // yellow (memory)
        } else {
            color = 0xff0000; // red
        }

        graphics.lineStyle(1, color, 0.5);
        graphics.strokeLineShape(new Phaser.Geom.Line(this.x, this.y, player.x, player.y));
    }

    chasePlayer(now, player, dist) {
        // Insert your path-following logic here
        const seesPlayer = dist < this.detectionRadius && this.hasLineOfSight();
        if (seesPlayer) {
            this.lastSeenPlayerTime = now;
        }

        const recentlySawPlayer = (now - this.lastSeenPlayerTime) < 2000; // memory duration: 2 sec
        if (seesPlayer || recentlySawPlayer) {

            // 🔁 Step along path if one exists
            if (this.path && this.currentPathIndex < this.path.length) {
                const step = this.path[this.currentPathIndex];
                const targetX = this.map.tileToWorldX(step.x) + this.map.tileWidth / 2;
                const targetY = this.map.tileToWorldY(step.y) + this.map.tileHeight / 2;

                const distToTarget = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);

                if (!this.stepTimeout) {
                    this.stepTimeout = now + 2000;
                }

                if (distToTarget < 10) {
                    this.currentPathIndex++;
                    this.stepTimeout = now + 2000;
                    
                } else {
                    // Movement tracking for jiggle
                    // Movement tracking and jiggle handling
                    const movedDist = Phaser.Math.Distance.Between(this.x, this.y, this.lastPos.x, this.lastPos.y);

                    if (movedDist > 1) {
                        this.lastMovedTime = now;
                        this.lastPos.set(this.x, this.y);
                        this.isJiggling = false;
                        this.jiggleCount = 0;
                    } if (!this.isJiggling && now - this.lastMovedTime > 2000) {
                        // Begin jiggle
                        // Push to adjacent walkable tile
                        const fromX = this.map.worldToTileX(this.x);
                        const fromY = this.map.worldToTileY(this.y);

                        // Directions to check: up, down, left, right
                        const offsets = [
                            { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
                            { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
                        ];

                        let pushed = false;

                        for (const offset of Phaser.Utils.Array.Shuffle(offsets)) {
                            const nx = fromX + offset.dx;
                            const ny = fromY + offset.dy;

                            // Bounds check
                            if (nx >= 0 && ny >= 0 && nx < this.map.width && ny < this.map.height) {
                                const tile = this.map.getTileAt(nx, ny, true, "Collisions");
                                if (tile && tile.index === -1) {
                                    // Move this instantly to adjacent tile
                                    this.setX(this.map.tileToWorldX(nx) + this.map.tileWidth / 2);
                                    this.setY(this.map.tileToWorldY(ny) + this.map.tileHeight / 2);
                                    pushed = true;
                                    break;
                                }
                            }
                        }

                        if (pushed) {
                            console.log("📦 Pushed this to adjacent tile");
                            this.lastMovedTime = now;
                            this.isJiggling = false;
                            this.jiggleCount++;

                            // Force repath
                            const toTileX = Phaser.Math.Clamp(this.map.worldToTileX(player.x), 0, this.map.width - 1);
                            const toTileY = Phaser.Math.Clamp(this.map.worldToTileY(player.y), 0, this.map.height - 1);
                            const fromTileX = Phaser.Math.Clamp(this.map.worldToTileX(this.x), 0, this.map.width - 1);
                            const fromTileY = Phaser.Math.Clamp(this.map.worldToTileY(this.y), 0, this.map.height - 1);

                            this.finder.findPath(fromTileX, fromTileY, toTileX, toTileY, (path) => {
                                if (path && path.length > 1) {
                                    this.path = path;
                                    this.currentPathIndex = 1;
                                    console.log("✅ Repath after adjacent push");
                                } else {
                                    this.path = [];
                                }
                            });
                            this.finder.calculate();
                        }

                    }

                    this.stepTimeout = now + 2000;
                    // Obstacle avoidance
                    const avoidForce = new Phaser.Math.Vector2(0, 0);
                    const chaseSpeed = this.chaseSpeed;
                    this.scene.obstacles.children.iterate((obstacle) => {
                        if (!obstacle.body) return;

                        const dist = Phaser.Math.Distance.Between(this.x, this.y, obstacle.x, obstacle.y);
                        const avoidRadius = 40;

                        if (dist < avoidRadius) {
                            const pushDir = new Phaser.Math.Vector2(this.x - obstacle.x, this.y - obstacle.y).normalize();
                            const strength = (avoidRadius - dist) / avoidRadius; // Stronger when closer
                            avoidForce.add(pushDir.scale(strength));
                        }
                    });

                    if (avoidForce.lengthSq() > 0) {
                        avoidForce.normalize().scale(30); // scale to desired steering force
                        this.body.velocity.add(avoidForce);
                    }

                    const avoidOtherEnemies = new Phaser.Math.Vector2(0, 0);

                    this.enemies.children.iterate((other) => {
                        if (other === this || !other.active) return;

                        const dist = Phaser.Math.Distance.Between(this.x, this.y, other.x, other.y);

                        if (dist < 24) { // only if too close
                            const push = new Phaser.Math.Vector2(this.x - other.x, this.y - other.y)
                                .normalize()
                                .scale((24 - dist) / 24); // stronger when closer
                            avoidOtherEnemies.add(push);
                        }
                    });

                    if (avoidOtherEnemies.lengthSq() > 0) {
                        avoidOtherEnemies.normalize().scale(15); // tweak this force value
                        this.body.velocity.add(avoidOtherEnemies);
                    }


                    this.scene.physics.moveTo(this, targetX, targetY, chaseSpeed);
                }
            } else {
                this.setVelocity(0);
            }


            // 🔁 Recalculate path periodically
            const toTileX = Phaser.Math.Clamp(this.map.worldToTileX(player.x), 0, this.map.width - 1);
            const toTileY = Phaser.Math.Clamp(this.map.worldToTileY(player.y), 0, this.map.height - 1);

            const fromTileX = Phaser.Math.Clamp(this.map.worldToTileX(this.x), 0, this.map.width - 1);
            const fromTileY = Phaser.Math.Clamp(this.map.worldToTileY(this.y), 0, this.map.height - 1);


            this.finder.findPath(fromTileX, fromTileY, toTileX, toTileY, (path) => {
                if (path && path.length > 1) {
                    this.path = path;
                    this.currentPathIndex = 1;

                } else {
                    this.path = [];
                    this.setVelocity(0);
                }
            });

            this.finder.calculate();

        }

    }

    wander(now) {
        // Insert your wander logic here

        if (now > this.nextWanderTime || !this.wanderTarget) {
            // Reset path
            this.path = [];
            this.currentPathIndex = 0;

            // Pick random nearby walkable tile
            const fromX = this.map.worldToTileX(this.x);
            const fromY = this.map.worldToTileY(this.y);

            const offsets = Phaser.Utils.Array.Shuffle([
                { dx: -1, dy: 0 },
                { dx: 1, dy: 0 },
                { dx: 0, dy: -1 },
                { dx: 0, dy: 1 },
                { dx: -1, dy: -1 },
                { dx: 1, dy: 1 },
                { dx: -1, dy: 1 },
                { dx: 1, dy: -1 },
            ]);

            for (const offset of offsets) {
                const nx = fromX + offset.dx;
                const ny = fromY + offset.dy;

                if (nx >= 0 && ny >= 0 && nx < this.map.width && ny < this.map.height) {
                    const tile = this.map.getTileAt(nx, ny, true, "Collisions");
                    if (tile && tile.index === -1) {
                        this.wanderTarget = {
                            x: this.map.tileToWorldX(nx) + this.map.tileWidth / 2,
                            y: this.map.tileToWorldY(ny) + this.map.tileHeight / 2
                        };
                        break;
                    }
                }
            }

            this.nextWanderTime = now + Phaser.Math.Between(2000, 4000);
        }

        // 💡 Move toward wanderTarget if it exists
        if (this.wanderTarget) {
            const dist = Phaser.Math.Distance.Between(this.x, this.y, this.wanderTarget.x, this.wanderTarget.y);
            if (dist < 8) {
                this.setVelocity(0);
                this.wanderTarget = null;
            } else {
                this.scene.physics.moveTo(this, this.wanderTarget.x, this.wanderTarget.y, this.wanderSpeed);
            }
        } else {
            this.setVelocity(0);
        }
    }
}
