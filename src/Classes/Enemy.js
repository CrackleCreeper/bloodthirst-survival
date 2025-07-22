import EasyStar from "easystarjs";
import Phaser from "phaser";
import BloodCrystal from "./BloodCrystal";
import MysteryCrystal from "./MysteryCrystal";

export default class Enemy extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, texture, config = {}) {
        super(scene, x, y, texture);

        // Physics
        this.scene = scene;
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.body.setCollideWorldBounds(true);
        this.body.setBounce(1);


        // Configurable attributes
        this.hp = config.hp || 3;
        this.speed = config.speed || 50;
        this.type = config.type || 'basic';
        this.map = scene.map;
        this.type = config.type || "Vampire1";
        this.obstacles = scene.obstacles;
        this.enemies = scene.enemies;
        this.scene.physics = scene.physics;
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
        this.detectionRadius = 350;
        this.wanderSpeed = 20;
        this.chaseSpeed = config.speed || 50;
        this.setDamping(true);
        this.setDrag(100);
        this.setSize(this.width, this.height, true);
        this.setOffset(14, 10);
        this.isDead = false;
        this.isAttacking = false;



        // Animations
        this.animPrefix = config.type.toLowerCase(); // change based on type in future
        this.direction = "down";
        this.currentAnim = null;
        this.animLockedUntil = 0;  // timestamp until which animation is locked




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
    }

    update(now, player) {
        if (this.isDead) return;
        if (this.scene.player.isDead) {
            this.playAnim("idle");
        }
        if (this.isAttacking) {
            this.setVelocity(0);
            return;
        }

        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 32) {
            this.setVelocity(0);
            this.path = []; // clear path when in melee
            this.currentPathIndex = 0;
            this.checkAttack(now, player);
            return;
        }

        let animState = "idle";

        // 🟡 CHASE PLAYER
        if (dist < this.detectionRadius && this.hasLineOfSight()) {
            this.seesPlayer = true;
            this.lastSeen = now;
            this.chasePlayer(now, player, dist);
            animState = "run";
        }

        // 🟠 MEMORY CHASE
        else if (this.seesPlayer && now - this.lastSeen < 2000) {
            this.chasePlayer(now, player, dist);
            animState = "run";
        }

        // 🟤 WANDERING
        else {
            this.seesPlayer = false;
            this.wander(now);
            animState = "walk";
        }

        this.updateMovementAnimation(animState);
    }

    updateMovementAnimation(animState) {
        if (this.isAttacking) return;
        if (this.scene.time.now < this.animLockedUntil) return;



        const vx = this.body.velocity.x;
        const vy = this.body.velocity.y;
        const moving = this.body.speed > 2;
        // Direction
        if (Math.abs(vx) > Math.abs(vy)) {
            this.direction = vx > 0 ? "right" : "left";
        } else if (Math.abs(vy) > 0) {
            this.direction = vy > 0 ? "down" : "up";
        }

        if (moving) {
            this.playAnim(animState); // "run" during chase, "walk" while wandering
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

    playAnim(state, lockDuration = 0) {
        const key = `${this.animPrefix}_${state}_${this.direction}`;
        if (this.anims.currentAnim?.key !== key) {
            this.anims.play(key, true);
            this.currentAnim = key;

            // Optional: lock animation to prevent overrides
            if (lockDuration > 0) {
                this.animLockedUntil = this.scene.time.now + lockDuration;
            }
        }
    }

    checkAttack(now, player) {
        if (this.attackCooldown > now) return;
        this.isAttacking = true;
        this.attackCooldown = now + 1000; // 1 second cooldown
        this.setVelocity(0);

        this.animLockedUntil = this.scene.time.now + 500;
        this.playAnim("attack", 500);

        this.scene.time.delayedCall(500, () => {  // attack hit frame
            if (!this.active || !player.active) return;
            this.animLockedUntil = 0;
            const dist = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y);
            if (dist < 32 && !player.invulnerable) {
                player.hp--;
                player.setTint(0xff0000);
                player.invulnerable = true;
                this.scene.time.delayedCall(100, () => player.clearTint());
                this.scene.time.delayedCall(1000, () => player.invulnerable = false);

            }

        });
        this.scene.time.delayedCall(1000, () => {
            if (this.active) this.isAttacking = false;
        });

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

    takeDamage(amount) {
        if (this.hp - amount > 0) {
            this.scene.sound.play('vampire_hurt', { volume: 0.9 });
        }
        if (this.isInvulnerable || !this.active) return;

        this.hp -= amount;
        this.isInvulnerable = true;

        const dir = this.lastDirection || "down"; // or infer from player
        this.playAnim("hurt", 500);

        this.scene.time.delayedCall(1000, () => {
            this.isInvulnerable = false;
        });

        if (this.hp <= 0) {
            this.anims.stop();
            this.die();
        }
    }

    die(spawnCrystal = true) {
        if (!this.active) return; // at top of die()
        if (this.isDead) return;
        this.isDead = true;

        this.setVelocity(0);
        this.anims.stop();
        this.scene.sound.play('vampire_die', { volume: 0.3 });
        this.anims.play(`${this.animPrefix}_death`, false);
        this.animLockedUntil = this.scene.time.now + 1000; // ~1s
        const frameRate = 10; // ← adjust based on your animation
        const totalFrames = 11; // frames 0 to 10
        const duration = (totalFrames / frameRate) * 1000;
        this.scene.time.delayedCall(duration, () => {

            let isthereMysteryCrystal = false;
            if (Phaser.Math.Between(1, 100) <= 15 && spawnCrystal) {  // 15% chance
                isthereMysteryCrystal = true;
                const mysteryCrystal = new MysteryCrystal(this.scene, this.x, this.y);
                this.scene.mysteryCrystals.add(mysteryCrystal);
                this.scene.physics.add.collider(mysteryCrystal, this.scene.layers.collisions);
            }


            if (spawnCrystal && !isthereMysteryCrystal) {
                const crystal = new BloodCrystal(this.scene, this.x, this.y, this.type);
                this.scene.crystals.add(crystal);
                this.scene.physics.add.collider(crystal, this.scene.layers.collisions);
                this.scene.physics.add.overlap(this.scene.player, this.scene.crystals, this.scene.collectCrystal, null, this.scene);
            }
            isthereMysteryCrystal = false; // reset for next enemy
            this.destroy()
        });
    }


    chasePlayer(now, player, dist) {
        if (dist < 20) {
            this.path = [];
            return;
        }

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
