import { ApiManager } from './ApiManager.js';
import { Map } from './Map.js';
import { io } from 'socket.io-client';
import { WeatherEffectManager } from './WeatherEffectManager.js';
import MysteryCrystal from './MysteryCrystal.js';
import BloodCrystal from './BloodCrystal.js';
import { socket } from "./Socket.js";
window.socket = socket; // Expose socket globally for debugging

export class Arena1_New_Multi extends Map {
    constructor() {
        super({
            key: 'Arena1_New_Multi',
            mapKey: 'Arena1_New',
            tilesets: [
                { name: "Grass", imageKey: "tileset", imagePath: "assets/Texture/TX Tileset Grass.png" },
                { name: "Wall", imageKey: "objects", imagePath: "assets/Texture/TX Tileset Wall.png" },
                { name: "Structure", imageKey: "structure", imagePath: "assets/Texture/TX Struct.png" },
                { name: "Plants", imageKey: "plants", imagePath: "assets/Texture/Extra/TX Plant with Shadow.png" },
                { name: "Props", imageKey: "props", imagePath: "assets/Texture/Extra/TX Props with Shadow.png" },
                { name: "Concrete", imageKey: "concrete", imagePath: "assets/Texture/TX Tileset Stone Ground.png" }
            ]
        });
    }
    init(data) {
        this.hostId = data?.host;
    }



    create() {
        // Map + tilesets
        this.gameOverScreenShown = false;
        this.map = this.make.tilemap({ key: this.mapKey });
        const tilesetObjs = this.tilesets.map(ts =>
            this.map.addTilesetImage(ts.name, ts.imageKey)
        );

        // Layers
        this.createLayers(this.map, tilesetObjs);

        // Camera/world bounds
        this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.setRoundPixels(true);

        // Obstacles (if you need them later)
        this.setupObstacles();

        // Puppet container (no physics needed)
        this.enemies = this.add.group();

        // Ensure animations are loaded once
        if (!this.anims.exists('player-idle-down') || !this.anims.exists('player2-idle-down')) {
            this.loadPlayerAnimations(this);
            this.loadAnimations(this);
        }
        this.areAnimationsLoaded = true;

        this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.swapKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.P);
        this.cursors = this.input.keyboard.createCursorKeys();
        this.W = this.input.keyboard.addKey('W');
        this.A = this.input.keyboard.addKey('A');
        this.S = this.input.keyboard.addKey('S');
        this.D = this.input.keyboard.addKey('D');
        this.canAttack = true;

        // Simple UI
        this.hpText = this.add.text(100, 80, "HP: 5", { fontSize: "16px Arial", fill: "#fff" })
            .setScrollFactor(0)
            .setDepth(999);
        this.currentLevelText = this.add.text(100, 140, `Level: 1`, { fontSize: '16px Arial', fill: '#fff' }).setScrollFactor(0).setDepth(999);
        this.timerText = this.add.text(100, 110, `Time Left: 30`, { fontSize: '16px Arial', fill: '#fff' }).setScrollFactor(0).setDepth(999);
        this.weatherText = this.add.text(100, 50, ``, { fontSize: '14px Arial', fill: '#fff' }).setScrollFactor(0);
        this.swapText = this.add.text(100, 170, "Swap Count: 0", {
            font: "16px Arial",
            fill: "#fff"
        });
        this.swapText.setScrollFactor(0);

        this.gameOver = false;
        this.currentLevel = 1;
        this.apiManager = new ApiManager(this);
        this.weatherManager = new WeatherEffectManager(this, this.apiManager, true);
        this.mysteryCrystals = this.physics.add.group();
        this.bloodCrystals = this.physics.add.group();

        // Multiplayer socket wiring
        this.setupMultiplayer();
        socket.emit("player-joined");
        socket.emit("joinGame", { x: 400, y: 200 });

        console.log("Multiplayer registered animations:", this.anims.anims.keys());

        // Debug
        // this.physics.world.createDebugGraphic();
    }


    init(data) {
        this.hostId = data?.host;
        this.roomCode = data?.roomCode; // ← Add this
    }

    setupMultiplayer() {
        socket.removeAllListeners();

        this.players = this.physics.add.group();
        this.frontendPlayers = {};
        this.socket = socket;
        socket.on("connect_error", (err) => console.error("Socket error:", err));

        socket.on("updatePlayers", (players) => {
            Object.values(players).forEach((playerInfo) => {
                let sprite = this.frontendPlayers[playerInfo.id];

                if (!sprite) {
                    // create new player sprite
                    let newPlayer;
                    if (playerInfo.id == this.hostId)
                        newPlayer = this.physics.add.sprite(playerInfo.x, playerInfo.y, 'main2_idle_down').setScale(1);
                    else
                        newPlayer = this.physics.add.sprite(playerInfo.x, playerInfo.y, 'main_idle_down').setScale(1);
                    newPlayer.playerId = playerInfo.id;
                    newPlayer.direction = "down";
                    newPlayer.setCollideWorldBounds(true);
                    newPlayer.speed = 250;
                    newPlayer.baseSpeed = 250;
                    newPlayer.setSize(20, 34);
                    newPlayer.setOffset(newPlayer.width / 2 - 10, newPlayer.height / 2 - 15);
                    newPlayer.setDepth(3);
                    newPlayer.isDead = false;
                    newPlayer.attackMultiplier = 1;
                    newPlayer.frozen = false;
                    newPlayer.flippedControls = false;
                    newPlayer.isAttacking = false;
                    newPlayer.beingHit = false;
                    newPlayer.hp = playerInfo.hp ?? 5;
                    newPlayer.swaps = 0;
                    newPlayer.currentRunSound = null;

                    // collide player with map
                    this.physics.add.collider(newPlayer, this.layers.collisions);

                    if (playerInfo.id === socket.id) {
                        this.cameras.main.setZoom(1.2);
                        this.cameras.main.startFollow(newPlayer);
                        this.hpText.setText(`HP: ${newPlayer.hp}`);
                    }

                    this.frontendPlayers[playerInfo.id] = newPlayer;

                    // TODO: VUNERABILITY
                    newPlayer.invulnerable = true;
                    socket.emit("setInvulnerable", { bool: true });
                    this.tweens.add({
                        targets: newPlayer,
                        alpha: 0,
                        ease: 'Linear',
                        duration: 200,
                        repeat: 14,
                        yoyo: true,
                        onComplete: () => {
                            newPlayer.alpha = 1;
                            newPlayer.invulnerable = false;
                            socket.emit("setInvulnerable", { bool: false });
                        }
                    });

                } else {

                    if (playerInfo.id === socket.id && typeof playerInfo.hp === "number") {
                        sprite.hp = playerInfo.hp;
                        this.hpText.setText(`HP: ${sprite.hp}`);
                    }
                    // update existing
                    sprite.setPosition(playerInfo.x, playerInfo.y);
                    if (!sprite.anims.isPlaying || sprite.direction !== playerInfo.direction) {
                        if (playerInfo.id == this.hostId)
                            sprite.anims.play(`player2-run-${playerInfo.direction}`, true);
                        else
                            sprite.anims.play(`player-run-${playerInfo.direction}`, true);
                        sprite.direction = playerInfo.direction;
                    }
                }
            });

            Object.keys(this.frontendPlayers).forEach((id) => {
                if (!players[id]) {
                    this.frontendPlayers[id].destroy();
                    delete this.frontendPlayers[id];
                }
            });
        });

        socket.on('currentPlayers', (players) => {
            for (const id in players) {
                if (id !== socket.id) {
                    this.addOtherPlayer(players[id]); // function to add other players
                }
            }
        });

        socket.on('playerJoined', (playerData) => {
            this.addOtherPlayer(playerData);
        });


        socket.on("playerAttack", ({ playerId, direction }) => {
            const p = this.frontendPlayers[playerId];
            if (!p) return;
            if (playerId == this.hostId)
                p.anims.play(`player2-attack-${direction}`, true);
            else
                p.anims.play(`player-attack-${direction}`, true);
            p.isAttacking = true;
            this.time.delayedCall(400, () => { if (p) p.isAttacking = false; });
        });

        socket.on("playerMoved", (data) => {
            // server only broadcasts to others; ignore my own echo
            if (data.playerId === socket.id) return;
            const p = this.frontendPlayers[data.playerId];
            if (!p) return;
            p.setPosition(data.x, data.y);
            if (data.playerId == this.hostId)
                p.anims.play(data.isMoving ? `player2-run-${data.direction}` : `player2-idle-${data.direction}`, true);
            else
                p.anims.play(data.isMoving ? `player-run-${data.direction}` : `player-idle-${data.direction}`, true);
        });

        // ✅ Replace the old playerDied handler with this:
        socket.on("gameResult", ({ win, loserId }) => {
            const me = this.frontendPlayers[socket.id];
            if (!me) return;

            if (!win) {
                // I lost - set my state to dead
                me.isDead = true;
                me.setVelocity?.(0, 0);
                me.disableBody?.(true, true);
                this.hpText.setText("HP: 0");
            }
            console.log(`The roomcode before is`, this.roomCode)
            this.scene.stop();
            console.log(`The roomcode after is`, this.roomCode)
            this.scene.start("GameOverScene", {
                win,
                roomCode: this.roomCode,
                hostId: this.hostId
            });
        });

        socket.on("removePlayer", (id) => {
            const player = this.frontendPlayers[id];
            if (player) {
                player.destroy();
                delete this.frontendPlayers[id];
            }
        });


        socket.on("spawnEnemy", (data) => {
            let enemySprite = this.enemies.getChildren().find(e => e.enemyId === data.id);
            if (!enemySprite) {
                const baseTextureKey = `${data.type.toLowerCase()}_idle`;
                enemySprite = this.add.sprite(data.x, data.y, baseTextureKey);
                enemySprite.enemyId = data.id;
                enemySprite.setDepth(3);
                this.enemies.add(enemySprite);
                this.physics.collide(enemySprite, this.layers.collisions);
            } else {
                enemySprite.setPosition(data.x, data.y);
            }
        });

        // Per-tick puppet update
        socket.on("enemyUpdate", (enemyList) => {
            enemyList.forEach((enemyData) => {
                let enemySprite = this.enemies.getChildren().find(e => e.enemyId === enemyData.id);
                if (!enemySprite) {
                    const baseTextureKey = `${enemyData.type.toLowerCase()}_idle`;
                    enemySprite = this.add.sprite(enemyData.x, enemyData.y, baseTextureKey);
                    enemySprite.enemyId = enemyData.id;
                    enemySprite.setDepth(3);
                    this.enemies.add(enemySprite);
                }

                const alpha = 0.35;
                enemySprite.x = Phaser.Math.Linear(enemySprite.x, enemyData.x, alpha);
                enemySprite.y = Phaser.Math.Linear(enemySprite.y, enemyData.y, alpha);

                // Debug Rectangle for enemies
                // Draw a debug rectangle
                // if (!enemySprite.debugRect) {
                //     enemySprite.debugRect = this.add.graphics().setDepth(10000);
                // }
                // enemySprite.debugRect.clear();
                // enemySprite.debugRect.lineStyle(1, 0xff0000);
                // enemySprite.debugRect.strokeRect(
                //     enemySprite.x - enemySprite.displayWidth * enemySprite.originX,
                //     enemySprite.y - enemySprite.displayHeight * enemySprite.originY,
                //     enemySprite.displayWidth,
                //     enemySprite.displayHeight
                // );


                // play animation if available
                // Only update animation if not locked
                if (!enemySprite.animationLockUntil || this.time.now > enemySprite.animationLockUntil) {
                    const wanted = enemyData.anim;
                    const current = enemySprite.anims.currentAnim?.key;

                    if (wanted && wanted !== current) {
                        if (this.anims.exists(wanted)) {
                            enemySprite.anims.play(wanted, true);
                        } else {
                            const fallbackWalk = `${enemyData.type}_walk_${enemyData.facing}`;
                            const fallbackIdle = `${enemyData.type}_idle_${enemyData.facing}`;
                            if (this.anims.exists(fallbackWalk)) {
                                enemySprite.anims.play(fallbackWalk, true);
                            } else if (this.anims.exists(fallbackIdle)) {
                                enemySprite.anims.play(fallbackIdle, true);
                            }
                        }
                    }
                }

            });
        });

        socket.on("enemyHit", ({ id, hp }) => {
            const s = this.enemies.getChildren().find(e => e.enemyId === id);
            if (!s) return;

            const type = s.texture.key.split("_")[0];
            const direction = s.anims.currentAnim?.key?.split("_").pop() || "down";

            const hurtAnim = `${type}_hurt_${direction}`;

            if (this.anims.exists(hurtAnim)) {
                s.anims.play(hurtAnim, true);
                this.sound.play('vampire_hurt', { volume: 0.9 });
                s.animationLockUntil = this.time.now + 400;
            } else {
                s.setTint(0xffaaaa);
                this.time.delayedCall(80, () => s.clearTint());
            }
        });


        socket.on("enemyKilled", ({ id }) => {
            const e = this.enemies.getChildren().find(s => s.enemyId === id);
            if (!e) return;

            const type = e.texture.key.split("_")[0];

            const deathAnim = `${type}_death`;

            if (this.anims.exists(deathAnim)) {
                e.anims.play(deathAnim, true);
                this.sound.play('vampire_die', { volume: 0.3 });
                e.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                    e.destroy();
                });
            } else {
                e.destroy(); // fallback
            }
        });


        socket.on("playerHit", ({ hp, knockback }) => {
            const me = this.frontendPlayers[socket.id];
            if (!me) return;
            if (me.invulnerable) return;
            me.hp = hp;
            me.setTint(0xff0000);
            this.hpText.setText(`HP: ${Math.max(0, me.hp)}`);
            me.invulnerable = true;

            if (me.body) {
                const kb = new Phaser.Math.Vector2(knockback.x, knockback.y).normalize().scale(200);
                // me.body.velocity.add(kb);
            }

            this.time.delayedCall(100, () => me.clearTint());
            this.time.delayedCall(1000, () => me.invulnerable = false);

            if (hp <= 0) {
                me.isDead = true;
                me.disableBody?.(true, true);
                this.showGameOverScreen?.();
            }
        });

        socket.on("playerDied", ({ win, loserId, roomCode }) => {
            console.log(`[CLIENT] Received playerDied: win=${win}, loserId=${loserId}, myId=${socket.id}`);

            const me = this.frontendPlayers[socket.id];
            if (!me) return;

            if (!win) {
                // I lost - set my state to dead
                me.isDead = true;
                me.setVelocity?.(0, 0);
                me.disableBody?.(true, true);
                this.hpText.setText("HP: 0");
            }
            console.log(`The roomcode before is`, roomCode)
            this.scene.stop();
            if (!this.gameOverScreenShown) {
                this.gameOverScreenShown = true;
                this.scene.start("GameOverScene", {
                    win,
                    loserId, // ✅ Now uses the server-provided win status
                    roomCode: roomCode,
                    hostId: this.hostId
                });
            }
        });


        socket.on("mysteryCrystalSpawn", ({ id, x, y }) => {
            const crystal = new MysteryCrystal(this, x, y);
            crystal.crystalId = id;
            this.mysteryCrystals.add(crystal);
            const localPlayer = this.frontendPlayers[socket.id];
            if (localPlayer) {
                this.physics.add.overlap(localPlayer, crystal, () => {
                    socket.emit("collectMysteryCrystal", { crystalId: id });
                });
            }

        });

        socket.on("bloodCrystalSpawn", ({ id, x, y, type }) => {
            const time = (10 / 11) * 1000;
            this.time.delayedCall(time, () => {
                const crystal = new BloodCrystal(this, x, y, type);
                crystal.crystalId = id;
                crystal.collected = false;
                this.bloodCrystals.add(crystal);

                const localPlayer = this.frontendPlayers[socket.id];
                if (localPlayer) {
                    this.physics.add.overlap(localPlayer, crystal, () => {
                        if (crystal.collected) return;
                        crystal.collected = true;
                        socket.emit("collectBloodCrystal", { crystalId: id, type });
                    });
                }
            });
        });


        socket.on("mysteryCrystalCollected", ({ crystalId }) => {
            this.mysteryCrystals.children.iterate(crystal => {
                if (!crystal) return;
                if (crystal.crystalId === crystalId) crystal.destroy();
            });
        });

        socket.on("bloodCrystalCollected", ({ crystalId }) => {
            this.bloodCrystals.children.iterate(crystal => {
                if (!crystal) return;
                if (crystal.crystalId === crystalId) crystal.destroy();
            });
        })

        socket.on("applyMysteryEffect", ({ playerId, effect }) => {
            const p = this.frontendPlayers[playerId];
            if (!p) return;
            const localOnlyEffects = ['flipControls', 'freezePlayer', 'hpDrop', 'massiveHeal', 'invincibility', 'speedFrenzy', 'speedLoss'];

            if (playerId === socket.id) {
                this.applyMysteryEffect(p, effect);  // Full effect with logic + visuals
            } else {
                console.log("Applying visuals")
                this.applyMysteryVisualOnly(p, effect);  // Just show tint, animation, circle, etc.
            }
        });

        socket.on("applyBloodCrystalEffect", ({ playerId, type }) => {

            const p = this.frontendPlayers[playerId];
            if (!p) return;
            if (playerId === socket.id) {
                this.applyBloodEffect(p, type, playerId);  // Full effect with logic + visuals
            } else {
                this.applyBloodEffectVisualOnly(p, type);
            }

        })

        socket.on("mysteryEffectVisual", ({ x, y, text, color }) => {
            this.showFloatingText(x, y, text, color);
        });

        socket.on("playerSwapped", ({ x, y }) => {
            const player = this.frontendPlayers[socket.id];
            if (player) {
                player.setPosition(x, y);
                this.cameras.main.flash(100, 255, 255, 255);
                this.sound.play('tp', { volume: 0.5 });
                // Optional: add camera shake, particles, etc.
            }
        });


        socket.on("updateSwapCountFrontEnd", ({ swapCount, playerId }) => {
            console.log("Trying to update count:", swapCount)
            this.frontendPlayers[playerId].gainSwapCount = swapCount;
            if (this.swapText) {
                this.swapText.setText("Swap Count: " + swapCount);
            }
        });




        socket.on("levelTimerUpdate", ({ remaining, currentLevel }) => {
            this.timerText.setText(`Time Left: ${remaining}`);
            this.currentLevelText.setText(`Level: ${currentLevel}`);
            this.currentLevel = currentLevel;
        });

        socket.on("levelComplete", ({ currentLevel }) => {
            const text = this.add.text(
                this.cameras.main.centerX,
                this.cameras.main.centerY,
                `LEVEL ${currentLevel - 1} COMPLETE!\nNext level starting soon...`,
                { fontSize: '32px', fill: '#ff0', align: 'center' }
            )
                .setOrigin(0.5)
                .setScrollFactor(0)
                .setDepth(999);

            this.time.delayedCall(8000, () => text.destroy());
        });

        socket.on("startNextLevel", ({ level, levelTime }) => {
            this.currentLevelText.setText(`Level: ${level}`);
            this.timerText.setText(`Time Left: ${levelTime}`);
        });

        socket.on("weatherUpdate", ({ code }) => {
            if (this.weatherManager) {
                this.weatherManager.applyFromCode(code);
            }
        });

        socket.on("lightningStrike", ({ x, y }) => {
            this.weatherManager.showLightningVisual(x, y);
        });



        socket.on("gameOver", () => {
            console.log("[Game Over] All gameplay halted.");
            this.gameOver = true;

            this.enemies.clear(true, true); // destroy all enemy puppets
            Object.values(this.frontendPlayers).forEach(p => p.setVelocity?.(0, 0));

            this.showGameOverScreen(); // <-- this was missing
        });

        socket.on("restartGame", () => {
            console.log("[Restart] Cleaning up and restarting scene");

            // Clean up current game state
            this.gameOver = false;
            this.frontendPlayers = {};

            // Clear all groups
            if (this.enemies) this.enemies.clear(true, true);
            if (this.mysteryCrystals) this.mysteryCrystals.clear(true, true);
            if (this.bloodCrystals) this.bloodCrystals.clear(true, true);

            // Restart the scene properly
            this.scene.restart({
                hostId: this.hostId,
                roomCode: this.roomCode
            });
        });





        socket.on("connect", () => {
            console.log("Connected to server with ID:", socket.id);
            socket.emit("readyForPlayers");
        });

        if (socket.connected) socket.emit("readyForPlayers");
    }

    addOtherPlayer(playerData) {
        // No-op or delegate to updatePlayers if needed
    }


    update(time, delta) {
        // super.update(time, delta);

        if (!this.frontendPlayers || !socket.id || !this.frontendPlayers[socket.id] || !this.areAnimationsLoaded) return;
        if (this.gameOver) return;
        const myPlayer = this.frontendPlayers[socket.id];
        if (myPlayer.slipping) return;
        if (Phaser.Input.Keyboard.JustDown(this.swapKey)) {
            console.log("Trying to swap")
            socket.emit("requestSwap", { playerId: socket.id });
        }
        if (Phaser.Input.Keyboard.JustDown(this.attackKey) && !this.beingHit && this.canAttack && !myPlayer.isAttacking) {
            const dir = myPlayer.direction || "down";

            socket.emit("playerAttack", {
                playerId: socket.id,
                direction: dir
            });

            myPlayer.setVelocity(0);
            myPlayer.isAttacking = true;
            this.canAttack = false;

            this.sound.play('player_attack', { volume: 0.5 });
            myPlayer.anims.stop();

            myPlayer.anims.play(`player2-attack-${dir}`, true);

            this.time.delayedCall(400, () => {
                myPlayer.isAttacking = false;
                this.canAttack = true;
            });

            return;
        }

        if (!myPlayer.isAttacking && !myPlayer.frozen) {
            const speed = myPlayer.speed;
            let direction = myPlayer.direction || "down";
            let moving = false;

            if (this.A.isDown) {
                if (!myPlayer.flippedControls) {
                    myPlayer.setVelocity(-speed, 0);
                    direction = "left";
                } else {
                    myPlayer.setVelocity(+speed, 0);
                    direction = "right";
                }
                moving = true;
            } else if (this.D.isDown) {
                if (!myPlayer.flippedControls) {
                    myPlayer.setVelocity(speed, 0);
                    direction = "right";
                } else {
                    myPlayer.setVelocity(-speed, 0);
                    direction = "left";
                }
                moving = true;
            } else if (this.W.isDown) {
                if (!myPlayer.flippedControls) {
                    myPlayer.setVelocity(0, -speed);
                    direction = "up";
                } else {
                    myPlayer.setVelocity(0, speed);
                    direction = "down";
                }
                moving = true;
            } else if (this.S.isDown) {
                if (!myPlayer.flippedControls) {
                    myPlayer.setVelocity(0, speed);
                    direction = "down";
                } else {
                    myPlayer.setVelocity(0, -speed);
                    direction = "up";
                }
                moving = true;
            } else {
                moving = false;
                myPlayer.setVelocity(0, 0);
                if (myPlayer.currentRunSound) {
                    this.sound.stopByKey(myPlayer.currentRunSound);
                    myPlayer.currentRunSound = null;
                }
            }

            // Animations
            if (moving) {
                if (!myPlayer.anims.isPlaying || myPlayer.direction !== direction) {
                    myPlayer.anims.play(`player2-run-${direction}`, true);
                    myPlayer.direction = direction;
                }

                if (myPlayer.currentRunSound && !this.sound.get(myPlayer.currentRunSound)) {
                    myPlayer.currentRunSound = null;
                }
                if (!myPlayer.currentRunSound) {
                    let runSound = this.weatherManager.isRaining ? 'running_on_wet_grass' : 'running_on_grass';
                    runSound = this.weatherManager.isSnowing ? 'running_on_snow' : runSound;
                    this.sound.play(runSound, { loop: true, volume: 0.5 });
                    myPlayer.currentRunSound = runSound;
                }

            } else {
                if (!myPlayer.anims.isPlaying || !myPlayer.anims.currentAnim.key.includes("idle")) {
                    myPlayer.anims.play(`player2-idle-${myPlayer.direction}`, true);
                }
            }

            // Emit movement update to server only if changed
            if (socket && this.frontendPlayers[socket.id]) {
                const { x, y } = myPlayer;
                const isMoving = moving;

                if (x !== this.lastSentX || y !== this.lastSentY || isMoving !== this.lastMoving || direction !== this.lastDirection) {
                    socket.emit("playerMoved", {
                        playerId: socket.id,
                        x, y,
                        isMoving,
                        direction
                    });

                    this.lastSentX = x;
                    this.lastSentY = y;
                    this.lastMoving = isMoving;
                    this.lastDirection = direction;
                }
            }
        }

    }

    applyMysteryEffect(player, effect) {
        console.log(`Mystery Effect: ${effect}`);
        const isPositive = ['massiveHeal', 'invincibility', 'speedFrenzy', 'multiAoE', 'clearEnemies'].includes(effect);
        let text = 'idk';

        switch (effect) {
            case 'massiveHeal':
                text = 'Massive Heal!';
                player.hp = Math.min(5, player.hp + 3);
                if (player.playerId === socket.id) this.hpText.setText(`HP: ${player.hp}`);
                socket.emit("updatePlayerHP", { hp: player.hp });
                break;

            case 'invincibility':
                text = 'Invincibility!';
                player.invulnerable = true;
                socket.emit("setInvulnerable", { bool: true });
                this.tweens.add({
                    targets: player,
                    alpha: 0,
                    ease: 'Linear',
                    duration: 200,
                    repeat: 14,
                    yoyo: true,
                    onComplete: () => {
                        player.alpha = 1;
                        player.invulnerable = false;
                        socket.emit("setInvulnerable", { bool: false });
                    }
                });
                break;

            case 'speedFrenzy':
                text = 'Speed++';
                player.speed = player.baseSpeed + 200;

                const colors = [0x00ffff, 0xff00ff, 0xffff00, 0xff6600];
                let colorIndex = 0;

                const colorTween = this.time.addEvent({
                    delay: 150,
                    callback: () => {
                        player.setTint(colors[colorIndex]);
                        colorIndex = (colorIndex + 1) % colors.length;
                    },
                    loop: true
                });

                this.time.delayedCall(7000, () => {
                    player.speed = player.baseSpeed;
                    player.clearTint();
                    colorTween.remove();
                });
                break;

            case 'multiAoE':
                if (player.playerId !== socket.id) break; // Only apply to local collector
                text = 'AoE Blast!';
                for (let i = 0; i < 5; i++) {
                    this.time.delayedCall(i * 1000, () => {
                        if (!player || player.isDead) return;
                        this.triggerAoEBlast({ x: player.x, y: player.y });
                    });
                }

                break;

            case 'clearEnemies':
                text = 'Enemies Cleared!';
                this.enemies.children.iterate(enemy => enemy?.destroy?.());
                break;

            case 'hpDrop':
                text = 'HP -2';
                player.hp = Math.max(0, player.hp - 2);
                if (player.playerId === socket.id) this.hpText.setText(`HP: ${player.hp}`);
                socket.emit("updatePlayerHP", { hp: player.hp });
                break;

            case 'speedLoss':
                text = 'Speed--';
                player.speed = Math.max(50, player.speed - 100);
                const pulseTween = this.tweens.add({
                    targets: player,
                    duration: 500,
                    repeat: -1,
                    yoyo: true,
                    tint: { from: 0xffffff, to: 0x3399ff }
                });
                this.time.delayedCall(7000, () => {
                    player.speed += 100;
                    player.clearTint();
                    pulseTween.stop();
                });
                break;

            case 'freezePlayer':
                text = 'Freeze';
                player.setTint(0x9999ff);
                player.frozen = true;
                this.time.delayedCall(3000, () => {
                    player.frozen = false;
                    player.clearTint();
                });
                break;

            case 'flipControls':
                text = 'Controls Flipped!';
                player.flippedControls = true;
                player.setTint(0xff00ff);
                this.time.delayedCall(7000, () => {
                    player.flippedControls = false;
                    player.clearTint();
                });
                break;
            case 'enemyWave':
                text = "Enemy Wave!";
                break;
            case 'clearEnemies':
                text = "Enemies Cleared!";
                break;
            case "gainSwap":
                text = "Swap Power!";
                player.gainSwapCount = (player.gainSwapCount || 0) + 1;
                socket.emit("swapCountUpdate", { swapCount: player.gainSwapCount, playerId: socket.id });
                this.swapText.setText(`Swap Count: ${player.gainSwapCount}`);
                break;
            // Announce that player can swap maybe.
        }

        this.sound.play('shard_collect', { volume: 0.5 });
        this.showFloatingText(player.x, player.y, text, isPositive ? '#00ff00' : '#ff0000');

    }

    applyMysteryVisualOnly(player, effect) {
        switch (effect) {
            case 'multiAoE':
                const { x, y } = player; // snapshot now
                for (let i = 0; i < 5; i++) {
                    this.time.delayedCall(i * 1000, () => {
                        if (!player || player.isDead) return;
                        this.spawnAoECircle(player.x, player.y);
                    });
                }

                break;


            case 'clearEnemies':
                break;

            case 'enemyWave':
                break;

            case 'massiveHeal':
                break;
            case 'freezePlayer':
                player.setTint(0x9999ff);
                break;

            case 'invincibility':
                this.tweens.add({
                    targets: player,
                    alpha: 0,
                    ease: 'Linear',
                    duration: 200,
                    repeat: 14,
                    yoyo: true,
                    onComplete: () => {
                        player.alpha = 1;
                    }
                });
                break;

            case 'speedFrenzy':
                const colors = [0x00ffff, 0xff00ff, 0xffff00, 0xff6600];
                let colorIndex = 0;
                const colorTween = this.time.addEvent({
                    delay: 150,
                    callback: () => {
                        player.setTint(colors[colorIndex]);
                        colorIndex = (colorIndex + 1) % colors.length;
                    },
                    loop: true
                });
                this.time.delayedCall(7000, () => {
                    player.clearTint();
                    colorTween.remove();
                });
                break;
        }
    }
    applyBloodEffectVisualOnly(player, type) {
        this.sound.play('shard_collect', { volume: 0.5 });

        switch (type) {
            case "Vampire1": {
                this.showFloatingText(player.x, player.y, '+1 HP', '#ff3333');
                break;
            }

            case "Vampire2": {
                this.showFloatingText(player.x, player.y, 'Speed Up!', '#ff8800');
                // Optional: Add a visual tint to show speed boost
                player.setTint(0xff8800);
                this.time.delayedCall(10000, () => player.clearTint());
                break;
            }

            case "Vampire3": {
                console.log(`Vampire3 visual effect - Current level: ${this.currentLevel}`);

                if (this.currentLevel <= 4) {
                    this.showFloatingText(player.x, player.y, 'Damage Up!', '#ff2222');
                    // Optional: Add visual indicator for damage boost
                    player.setTint(0xff2222);
                    this.time.delayedCall(5000, () => player.clearTint());
                } else {
                    this.showFloatingText(player.x, player.y, 'Blast!', '#ff4444');
                    // ✅ Show AoE visual for other players
                    this.spawnAoECircle(player.x, player.y);
                }
                break;
            }

            default:
                console.warn("Unknown blood crystal type:", type);
        }
    }


    spawnAoECircle(x, y) {
        console.log(`Spawning AoE circle at ${x}, ${y}`); // ✅ Add debug

        if (typeof x !== 'number' || typeof y !== 'number') {
            console.warn("Invalid AoE coords:", x, y);
            return;
        }

        // ✅ Enhanced visual effect for better visibility
        const circle = this.add.circle(x, y, 100, 0xff3333, 0.4).setDepth(1000);

        // ✅ Add a scaling animation for better visibility
        this.tweens.add({
            targets: circle,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => circle.destroy()
        });

        // ✅ Add a warning indicator before the blast
        const warningCircle = this.add.circle(x, y, 100, 0xff0000, 0.2).setDepth(999);
        this.tweens.add({
            targets: warningCircle,
            alpha: 0,
            duration: 200,
            yoyo: true,
            repeat: 1,
            onComplete: () => warningCircle.destroy()
        });

        // ✅ Add particle effect for more impact
        const particles = this.add.particles(x, y, 'pixel', {
            speed: { min: 50, max: 150 },
            scale: { start: 0.3, end: 0.1 },
            blendMode: 'ADD',
            lifespan: 300,
            color: "0xff0000",
            quantity: 20
        });

        this.time.delayedCall(400, () => particles.destroy());
    }



    triggerAoEBlast({ x, y }) {
        console.log('AoE blast triggered!');
        const blastRadius = 100;

        // ✅ Enhanced visual effect
        const circle = this.add.circle(x, y, blastRadius, 0xff0000, 0.3).setDepth(1000);

        // ✅ Add a scaling animation for better visibility
        this.tweens.add({
            targets: circle,
            scaleX: 1.5,
            scaleY: 1.5,
            alpha: 0,
            duration: 500,
            ease: 'Power2',
            onComplete: () => circle.destroy()
        });

        // ✅ Add particle effect for more impact
        const particles = this.add.particles(x, y, 'pixel', {
            speed: { min: 50, max: 150 },
            scale: { start: 0.3, end: 0.1 },
            blendMode: 'ADD',
            lifespan: 300,
            color: "0xff0000",
            quantity: 20,
        });

        this.time.delayedCall(400, () => particles.destroy());

        // Tell server to apply AoE damage
        socket.emit("aoeBlast", { x, y, radius: blastRadius });
    }


    applyBloodEffect(player, type, playerId) {
        const isLocal = socket.id === playerId;

        this.sound.play('shard_collect', { volume: 0.5 });

        switch (type) {
            case "Vampire1": {
                player.hp = Math.min(player.hp + 1, 5);
                if (isLocal) this.hpText.setText(`HP: ${player.hp}`);
                this.showFloatingText(player.x, player.y, '+1 HP', '#ff3333');
                socket.emit("updatePlayerHP", { hp: player.hp });
                break;
            }

            case "Vampire2": {
                player.speed += 100;
                this.showFloatingText(player.x, player.y, 'Speed Up!', '#ff8800');
                this.time.delayedCall(10 * 1000, () => {
                    player.speed -= 100;
                });
                break;
            }

            case "Vampire3": {
                console.log(`Vampire3 effect - Current level: ${this.currentLevel}, isLocal: ${isLocal}`);

                if (this.currentLevel <= 4) {
                    console.log("Applying damage multiplier");
                    player.attackMultiplier = 2;
                    this.showFloatingText(player.x, player.y, 'Damage Up!', '#ff2222');
                    this.time.delayedCall(5000, () => {
                        player.attackMultiplier = 1;
                    });
                } else {
                    console.log("Applying AoE blast");
                    this.showFloatingText(player.x, player.y, 'Blast!', '#ff4444');
                    if (isLocal) {
                        console.log("Triggering local AoE");
                        this.triggerAoEBlast({ x: player.x, y: player.y });
                    } else {
                        console.log("Spawning visual AoE");
                        this.spawnAoECircle(player.x, player.y);
                    }
                }
                break;
            }



            default:
                console.warn("Unknown blood crystal type:", type);
        }
    }
    showGameOverScreen() {
        const text = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            "GAME OVER",
            { fontSize: '48px', fill: '#ff0000', fontFamily: 'Arial', align: 'center' }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(999);

        this.input.keyboard.once("keydown-ENTER", () => {
            socket.emit("playerReady");
        });

    }
    isSceneActive() {
        return this.scene && this.scene.isActive() && !this.sys.isDestroyed();
    }


}
