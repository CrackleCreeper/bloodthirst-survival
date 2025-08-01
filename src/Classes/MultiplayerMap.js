import { Map } from './Map.js';
import { io } from 'socket.io-client';
const socket = io('http://localhost:3000', {
    transports: ['websocket']
});
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

    create() {
        // 1) Map + tilesets
        this.map = this.make.tilemap({ key: this.mapKey });
        const tilesetObjs = this.tilesets.map(ts =>
            this.map.addTilesetImage(ts.name, ts.imageKey)
        );

        // 2) Layers
        this.createLayers(this.map, tilesetObjs);

        // 3) Camera/world bounds
        this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.setRoundPixels(true);

        // 4) Obstacles (if you need them later)
        this.setupObstacles();

        // 5) Puppet container (no physics needed)
        this.enemies = this.add.group();

        // 6) Ensure animations are loaded once
        if (!this.anims.exists('player-idle-down')) {
            this.loadPlayerAnimations(this);
            this.loadAnimations(this);
        }
        this.areAnimationsLoaded = true;

        // 7) Minimal input so update() won’t crash
        this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.cursors = this.input.keyboard.createCursorKeys();
        this.W = this.input.keyboard.addKey('W');
        this.A = this.input.keyboard.addKey('A');
        this.S = this.input.keyboard.addKey('S');
        this.D = this.input.keyboard.addKey('D');
        this.canAttack = true;

        // 8) Simple UI
        this.hpText = this.add.text(100, 80, "HP: 5", { fontSize: "16px", fill: "#fff" })
            .setScrollFactor(0)
            .setDepth(999);
        this.currentLevelText = this.add.text(100, 140, `Level: 1`, { fontSize: '14px', fill: '#fff' }).setScrollFactor(0).setDepth(999);
        this.timerText = this.add.text(100, 110, `Time Left: 30`, { fontSize: '18px', fill: '#fff' }).setScrollFactor(0).setDepth(999);

        this.gameOver = false;

        // 9) Multiplayer socket wiring
        this.setupMultiplayer();
        socket.emit("player-joined");

        console.log("Multiplayer registered animations:", this.anims.anims.keys());
    }



    setupMultiplayer() {
        this.players = this.physics.add.group();
        this.frontendPlayers = {};

        socket.on("connect_error", (err) => console.error("Socket error:", err));

        socket.on("updatePlayers", (players) => {
            Object.values(players).forEach((playerInfo) => {
                let sprite = this.frontendPlayers[playerInfo.id];

                if (!sprite) {
                    // create new player sprite
                    const newPlayer = this.physics.add.sprite(playerInfo.x, playerInfo.y, 'main_idle_down').setScale(1);
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

                    // collide player with map
                    this.physics.add.collider(newPlayer, this.layers.collisions);

                    // 📌 Follow only the local player
                    if (playerInfo.id === socket.id) {
                        this.cameras.main.setZoom(1.2);
                        this.cameras.main.startFollow(newPlayer);
                        this.hpText.setText(`HP: ${newPlayer.hp}`);
                    }

                    this.frontendPlayers[playerInfo.id] = newPlayer;
                } else {

                    if (playerInfo.id === socket.id && typeof playerInfo.hp === "number") {
                        sprite.hp = playerInfo.hp;
                        this.hpText.setText(`HP: ${sprite.hp}`);
                    }
                    // update existing
                    sprite.setPosition(playerInfo.x, playerInfo.y);
                    if (!sprite.anims.isPlaying || sprite.direction !== playerInfo.direction) {
                        sprite.anims.play(`player-run-${playerInfo.direction}`, true);
                        sprite.direction = playerInfo.direction;
                    }
                }
            });

            // prune disconnected players
            Object.keys(this.frontendPlayers).forEach((id) => {
                if (!players[id]) {
                    this.frontendPlayers[id].destroy();
                    delete this.frontendPlayers[id];
                }
            });
        });

        socket.on("playerAttack", ({ playerId, direction }) => {
            const p = this.frontendPlayers[playerId];
            if (!p) return;
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
            p.anims.play(data.isMoving ? `player-run-${data.direction}` : `player-idle-${data.direction}`, true);
        });

        // Spawn puppet on first sight
        socket.on("spawnEnemy", (data) => {
            let enemySprite = this.enemies.getChildren().find(e => e.enemyId === data.id);
            if (!enemySprite) {
                // Use a valid TEXTURE key you actually loaded (match singleplayer)
                const baseTextureKey = `${data.type.toLowerCase()}_idle`; // e.g. "vampire1_idle"
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

                // smooth position
                const alpha = 0.35;
                enemySprite.x = Phaser.Math.Linear(enemySprite.x, enemyData.x, alpha);
                enemySprite.y = Phaser.Math.Linear(enemySprite.y, enemyData.y, alpha);

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

            const type = s.texture.key.split("_")[0]; // "vampire1"
            const direction = s.anims.currentAnim?.key?.split("_").pop() || "down";

            const hurtAnim = `${type}_hurt_${direction}`;

            if (this.anims.exists(hurtAnim)) {
                s.anims.play(hurtAnim, true);
                s.animationLockUntil = this.time.now + 400; // lock for 400ms
            } else {
                s.setTint(0xffaaaa);
                this.time.delayedCall(80, () => s.clearTint());
            }
        });



        // Use the right property here (enemyId)
        socket.on("enemyKilled", ({ id }) => {
            const e = this.enemies.getChildren().find(s => s.enemyId === id);
            if (!e) return;

            const type = e.texture.key.split("_")[0]; // "vampire1", "vampire2", etc.

            const deathAnim = `${type}_death`;

            if (this.anims.exists(deathAnim)) {
                e.anims.play(deathAnim, true);
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

            me.hp = hp;
            me.setTint(0xff0000);
            this.hpText.setText(`HP: ${Math.max(0, me.hp)}`);
            me.invulnerable = true;

            if (me.body) {
                const kb = new Phaser.Math.Vector2(knockback.x, knockback.y).normalize().scale(200);
                me.body.velocity.add(kb);
            }

            this.time.delayedCall(100, () => me.clearTint());
            this.time.delayedCall(1000, () => me.invulnerable = false);

            if (hp <= 0) {
                me.isDead = true;
                me.disableBody?.(true, true);
                this.showGameOverScreen?.();
            }
        });

        socket.on("playerDied", () => {
            const me = this.frontendPlayers[socket.id];
            if (!me) return;
            me.isDead = true;
            me.setVelocity?.(0, 0);
            me.disableBody?.(true, true);
            this.hpText.setText("HP: 0");
            socket.emit("playerDied");
            this.showGameOverScreen?.();
        });

        socket.on("levelTimerUpdate", ({ remaining, currentLevel }) => {
            this.timerText.setText(`Time Left: ${remaining}`);
            this.currentLevelText.setText(`Level: ${currentLevel}`);
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

        socket.on("gameOver", () => {
            console.log("[Game Over] All gameplay halted.");
            this.gameOver = true;

            this.enemies.clear(true, true); // destroy all enemy puppets
            Object.values(this.frontendPlayers).forEach(p => p.setVelocity?.(0, 0));

            this.showGameOverScreen(); // <-- this was missing
        });



        socket.on("connect", () => {
            console.log("Connected to server with ID:", socket.id);
            socket.emit("readyForPlayers");
        });

        if (socket.connected) socket.emit("readyForPlayers");
    }

    update(time, delta) {
        // super.update(time, delta);

        if (!this.frontendPlayers || !socket.id || !this.frontendPlayers[socket.id] || !this.areAnimationsLoaded) return;
        if (this.gameOver) return;
        const myPlayer = this.frontendPlayers[socket.id];

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
            myPlayer.anims.play(`player-attack-${dir}`, true);

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
                myPlayer.setVelocity(-speed, 0);
                direction = "left";
                moving = true;
            } else if (this.D.isDown) {
                myPlayer.setVelocity(speed, 0);
                direction = "right";
                moving = true;
            } else if (this.W.isDown) {
                myPlayer.setVelocity(0, -speed);
                direction = "up";
                moving = true;
            } else if (this.S.isDown) {
                myPlayer.setVelocity(0, speed);
                direction = "down";
                moving = true;
            } else {
                myPlayer.setVelocity(0, 0);
            }

            // Animations
            if (moving) {
                if (!myPlayer.anims.isPlaying || myPlayer.direction !== direction) {
                    myPlayer.anims.play(`player-run-${direction}`, true);
                    myPlayer.direction = direction;
                }
            } else {
                if (!myPlayer.anims.isPlaying || !myPlayer.anims.currentAnim.key.includes("idle")) {
                    myPlayer.anims.play(`player-idle-${myPlayer.direction}`, true);
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

    showGameOverScreen() {
        const text = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            "GAME OVER",
            { fontSize: '48px', fill: '#ff0000', fontFamily: 'Arial', align: 'center' }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(999);
    }

}
