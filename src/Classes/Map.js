// BaseMap.js
import Phaser from "phaser";
import EasyStar from "easystarjs";
import Enemy from "./Enemy";
import { ApiManager } from "./ApiManager";
import { WeatherEffectManager } from './WeatherEffectManager';
import MysteryCrystal from "./MysteryCrystal";
import { multiplayer } from "./Socket"; // Adjust the import path as necessary


const MELEE_RANGE = 45;
const ENEMY_MELEE_RANGE = 32;

export class Map extends Phaser.Scene {
    constructor(config) {
        super({ key: config.key });
        this.mapKey = config.mapKey;
        this.tilesets = config.tilesets;
        this.apiManager = new ApiManager(this);
        this.ready = false;
        this.levelComplete = false;
        this.areAnimationsLoaded = false;





        // Level and time
        this.levelTime = 30; // 30 seconds survival time for level one.
        this.elapsedTime = 0;
        this.level = 1;

        // Score System.
        this.score = 0;
        this.survivalTime = 0;
        this.enemiesKilled = 0;
        this.bloodCrystals1 = 0;
        this.bloodCrystals2 = 0;
        this.bloodCrystals3 = 0;
        this.mysteryBuffs = 0;
        this.mysteryNerfs = 0;
        this.weatherCount = 0;

    }

    preload() {
    }



    async create() {

        const map = this.make.tilemap({ key: this.mapKey });
        this.map = map;
        this.easystar = new EasyStar.js();
        this.easystar.setIterationsPerCalculation(20);
        // Load tilesets
        this.weatherText = this.add.text(100, 50, ``, { fontSize: '14px', fill: '#fff' }).setScrollFactor(0).setDepth(999);
        this.hpText = this.add.text(100, 80, "HP: 5", { fontSize: "16px", fill: "#fff" }).setScrollFactor(0).setDepth(999);
        this.speedText = this.add.text(10, 30, "", { fontSize: "14px", fill: "#fff" }).setScrollFactor(0).setDepth(999);
        this.currentLevelText = this.add.text(100, 140, `Level: ${this.level}`, { fontSize: '14px', fill: '#fff' }).setScrollFactor(0).setDepth(999);
        this.timerText = this.add.text(100, 110, `Time Left: ${this.levelTime}`, { fontSize: '18px', fill: '#fff' }).setScrollFactor(0).setDepth(999);

        this.scoreText = this.add.text(100, 170, `Blood Points: 0`, { fontSize: '18px', fill: '#fff' }).setScrollFactor(0).setDepth(999);

        const tilesetObjs = this.tilesets.map(ts => map.addTilesetImage(ts.name, ts.imageKey));
        this.apiManager = new ApiManager(this);

        // Only spawn if multiplayer is on.

        this.spawnPlayer();
        this.setupInput();

        this.createLayers(map, tilesetObjs);
        this.spawnEnemies();
        this.setupCamera();
        this.setupObstacles();
        this.weatherEffects = new WeatherEffectManager(this, this.apiManager);
        await this.apiManager.init();
        this.weatherText.setText(`Weather: Loading...`);
        this.time.delayedCall(1000, () => {
            console.log("Audio keys loaded:", this.cache.audio.getKeys());

            this.weatherEffects.apply();
        });
        if (!this.anims.exists('player-idle-up')) {
            this.loadPlayerAnimations(this);
            this.loadAnimations(this);
        }

        this.physics.add.collider(this.player, this.layers.collisions);

        this.hpText.setDepth(999);
        this.weatherText.setDepth(999);
        this.speedText.setDepth(999);

        // Crystals
        this.crystals = this.physics.add.group();
        this.mysteryCrystals = this.physics.add.group();
        this.physics.add.overlap(this.player, this.mysteryCrystals, this.collectMysteryCrystal, null, this);


        // Pathfinding setup
        const grid = [];

        for (let y = 0; y < this.map.height; y++) {
            const col = [];
            for (let x = 0; x < this.map.width; x++) {
                const tile = this.layers.collisions.getTileAt(x, y);
                col.push(tile && tile.index !== -1 ? 1 : 0); // 1 = unwalkable, 0 = walkable
            }
            grid.push(col);
        }

        this.easystar.setGrid(grid);
        this.easystar.setAcceptableTiles([0]);
        this.easystar.setIterationsPerCalculation(20);

        this.spawnLoop = this.time.addEvent({
            delay: 10 * 1000, // base delay, adjust dynamically later
            loop: true,
            callback: () => this.dynamicEnemySpawn()
        });

        this.mysteryCrystalLoop = this.time.addEvent({
            delay: 50 * 1000, // every 50 seconds or so
            loop: true,
            callback: () => this.spawnMysteryCrystal()
        });
        // this.physics.world.createDebugGraphic();

        this.ready = true;
        // this.startGame();
        this.dynamicEnemySpawn();

        this.player.invulnerable = true;
        this.tweens.add({
            targets: this.player,
            alpha: 0,
            ease: 'Linear',
            duration: 200,
            repeat: 14,
            yoyo: true,
            onComplete: () => {
                this.player.alpha = 1;
                this.player.invulnerable = false;
            }
        });

        this.pauseKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.pauseKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
        this.pauseKey.on('down', () => {
            if (this.scene.isActive('PauseScene')) {
                // Resume game
                this.scene.stop('PauseScene');
                this.scene.resume(); // resumes itself
            } else {
                // Pause game
                this.scene.launch('PauseScene', { parent: this.scene.key });
                this.scene.pause(); // pauses itself
            }
        });


    }

    update() {
        if (this.levelComplete) {
            if (!this.player.isDead) {
                this.player.setVelocity(0);
                this.player.anims.play(`player-idle-${this.player.direction}`, true);
            }
            return;
        }

        if (!this.ready) return;
        this.elapsedTime += this.game.loop.delta / 1000;
        this.survivalTime += this.game.loop.delta / 1000;
        const remaining = Math.max(0, this.levelTime - Math.floor(this.elapsedTime));
        this.timerText.setText(`Time Left: ${remaining}`);

        if (remaining <= 0) {
            this.nextLevel();
            return; // skip rest of update during transition
        }


        if (this.player.slipping) return;
        if (!this.player.active || !this.player.body) return;

        const speed = this.player.speed ?? 150;

        const body = this.player.body;
        this.hpText.setText(`HP: ${this.player.hp}`);

        const left = this.player.flippedControls ? this.cursors.right.isDown : this.cursors.left.isDown;
        const right = this.player.flippedControls ? this.cursors.left.isDown : this.cursors.right.isDown;
        const up = this.player.flippedControls ? this.cursors.down.isDown : this.cursors.up.isDown;
        const down = this.player.flippedControls ? this.cursors.up.isDown : this.cursors.down.isDown;
        if (this.player.frozen) {
            this.player.setVelocity(0);
            this.player.anims.play(`player-idle-${this.player.direction}`, true);
            return;
        }
        if (Phaser.Input.Keyboard.JustDown(this.attackKey) && !this.beingHit && this.canAttack && !this.player.isAttacking) {
            this.sound.play('player_attack', { volume: 0.5 });
            const dir = this.player.direction || "down";
            this.player.setVelocity(0);
            this.player.isAttacking = true;
            this.canAttack = false;
            this.player.anims.stop();

            this.player.anims.play(`player-attack-${dir}`, true);
            this.time.delayedCall(400, () => {
                this.player.isAttacking = false;
                this.canAttack = true;
            });
            return;
        }

        this.player.setVelocity(0);
        // Stop previous run sounds if direction changes
        if (this.player.currentRunSound && !this.sound.get(this.player.currentRunSound)) {
            this.player.currentRunSound = null;
        }

        if (!this.player.isAttacking && this.time.now > (this.player.hurtUntil || 0)) {
            if (left || right || up || down) {
                if (!this.player.currentRunSound) {
                    let runSound = this.weatherEffects.isRaining ? 'running_on_wet_grass' : 'running_on_grass';
                    runSound = this.weatherEffects.isSnowing ? 'running_on_snow' : runSound;
                    this.sound.play(runSound, { loop: true, volume: 0.5 });
                    this.player.currentRunSound = runSound;
                }

                if (left) {
                    this.player.setVelocityX(-speed);
                    this.player.anims.play("player-run-left", true);
                    this.player.direction = "left";
                } else if (right) {
                    this.player.setVelocityX(speed);
                    this.player.anims.play("player-run-right", true);
                    this.player.direction = "right";
                } else if (up) {
                    this.player.setVelocityY(-speed);
                    this.player.anims.play("player-run-up", true);
                    this.player.direction = "up";
                } else if (down) {
                    this.player.setVelocityY(speed);
                    this.player.anims.play("player-run-down", true);
                    this.player.direction = "down";
                }
            } else {
                this.player.setVelocity(0);
                this.player.anims.play(`player-idle-${this.player.direction}`, true);

                // ✅ Stop sound when idle
                if (this.player.currentRunSound) {
                    this.sound.stopByKey(this.player.currentRunSound);
                    this.player.currentRunSound = null;
                }
            }
        } else {
            this.player.setVelocity(0);
            if (this.player.currentRunSound) {
                this.sound.stopByKey(this.player.currentRunSound);
                this.player.currentRunSound = null;
            }
        }


        this.enemies.children.iterate(enemy => {
            if (!enemy.active) return;
            if (!enemy.body) return;

            enemy.update(this.time.now, this.player);
            const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            if (distance < MELEE_RANGE && this.player.isAttacking) enemy.takeDamage(1 * (this.player.attackMultiplier || 1));


            const inAttackRange = distance < ENEMY_MELEE_RANGE;
            if (inAttackRange && !enemy.hasHitPlayer && !this.player.invulnerable) {
                enemy.hasHitPlayer = true;

                enemy.playAnim("attack", 500);
                this.beingHit = true;
                this.time.delayedCall(400, () => {
                    if (
                        enemy.active && this.player.active &&
                        Phaser.Geom.Intersects.RectangleToRectangle(this.player.getBounds(), enemy.getBounds())
                    ) {
                        this.sound.play('player_hurt', { volume: 0.5 });
                        this.player.hp--;
                        this.player.invulnerable = true;
                        this.player.setTint(0xff0000);
                        const knockback = new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y).normalize().scale(200);
                        this.player.body.velocity.add(knockback);

                        this.time.delayedCall(100, () => this.player.clearTint());
                        this.time.delayedCall(1000, () => this.player.invulnerable = false);
                        if (this.player.hp <= 0) {
                            this.player.isDead = true;
                            this.sound.play('game_over', { volume: 0.5 });
                            this.player.disableBody(true, true);
                            this.player.destroy();
                            this.spawnLoop.remove();
                            this.showGameOverScreen();

                        }
                    }
                    this.beingHit = false;
                });
                this.time.delayedCall(1000, () => enemy.hasHitPlayer = false);
            }
        });
    }


    createLayers(map, tilesets) {
        this.layers = {
            background: map.createLayer("Background", tilesets, 0, 0),
            collisions: map.createLayer("Collisions", tilesets, 0, 0),
            shadows: map.createLayer("Shadows", tilesets, 0, 0),
            overhead: map.createLayer("Overhead", tilesets, 0, 0)
        };
        this.layers.collisions.setCollisionByExclusion([-1]);
        this.layers.background.setDepth(0);
        this.layers.shadows.setDepth(1);
        this.layers.collisions.setDepth(2);

        this.layers.overhead.setDepth(4);
    }

    spawnPlayer() {
        this.player = this.physics.add.sprite(400, 200, 'main_idle_down').setScale(1);
        this.player.setCollideWorldBounds(true);
        this.player.speed = 250;
        this.player.baseSpeed = 250; // Store base speed for weather effects
        this.player.setSize(20, 34);
        this.player.setOffset(this.player.width / 2 - 10, this.player.height / 2 - 15);
        this.player.setDepth(3);
        this.player.isDead = false;
        this.player.attackMultiplier = 1; // Default attack multiplier
        this.player.frozen = false;
        this.player.flippedControls = false;

    }

    spawnEnemies() {
        const spawnerObjects = this.map.getObjectLayer("Spawners").objects;
        this.enemies = this.physics.add.group();
        spawnerObjects.forEach(obj => {
            const enemy = new Enemy(this, obj.x, obj.y, "vampire1_idle", {
                hp: 1, speed: 50, type: "Vampire1", x: 8, y: 8
            });
            this.time.delayedCall(10, () => enemy.playAnim('idle'));
            this.enemies.add(enemy);
            this.physics.add.collider(enemy, this.layers.collisions);
        });
    }

    setupObstacles() {
        this.obstacles = this.physics.add.staticGroup();
        this.map.getLayer("Collisions").tilemapLayer.forEachTile(tile => {
            if (tile.index !== -1) {
                const worldX = this.map.tileToWorldX(tile.x) + this.map.tileWidth / 2;
                const worldY = this.map.tileToWorldY(tile.y) + this.map.tileHeight / 2;
                const obstacle = this.obstacles.create(worldX, worldY, null).setSize(this.map.tileWidth, this.map.tileHeight);
                obstacle.visible = false;
            }
        });
    }

    getRandomValidTile() {
        const maxAttempts = 30;
        let attempts = 0;
        let tile = null;

        while (attempts < maxAttempts) {
            const tileX = Phaser.Math.Between(0, this.map.width - 1);
            const tileY = Phaser.Math.Between(0, this.map.height - 1);
            const collisionTile = this.layers.collisions.getTileAt(tileX, tileY);
            const backgroundTile = this.layers.background.getTileAt(tileX, tileY);

            if (
                (!collisionTile || collisionTile.index === -1) && // no obstacle
                backgroundTile && backgroundTile.index !== -1     // valid ground tile (not transparent)
            ) {
                tile = { x: this.map.tileToWorldX(tileX) + this.map.tileWidth / 2, y: this.map.tileToWorldY(tileY) + this.map.tileHeight / 2 };
                break;
            }

            attempts++;
        }

        return tile;
    }



    dynamicEnemySpawn() {
        const btcPrice = this.apiManager.getBitcoinPrice();
        const extraEnemies = Math.floor(btcPrice / 10000);
        for (let i = 0; i < 1 + extraEnemies; i++) {
            const type = this.getRandomEnemyType(this.level);
            const { x, y } = this.getRandomValidTile();
            const enemy = new Enemy(this, x, y, `${type.toLowerCase()}_idle`, this.getEnemyStats(type));

            this.enemies.add(enemy);
            this.physics.add.collider(enemy, this.layers.collisions);
        }
    }

    weightedRandomChoice(choices) {
        const total = choices.reduce((sum, c) => sum + c.chance, 0);
        const rand = Phaser.Math.Between(0, total - 1);
        let cumulative = 0;
        for (const choice of choices) {
            cumulative += choice.chance;
            if (rand < cumulative) return choice.type;
        }
        return choices[0].type;
    }

    getEnemySpawnWeights(level) {
        if (level <= 2) {
            return { Vampire1: 100, Vampire2: 0, Vampire3: 0 };
        } else if (level <= 4) {
            return { Vampire1: 70, Vampire2: 20, Vampire3: 0 };
        } else if (level <= 5) {
            return { Vampire1: 40, Vampire2: 50, Vampire3: 10 };
        } else if (level <= 6) {
            return { Vampire1: 20, Vampire2: 50, Vampire3: 30 };
        } else {
            return { Vampire1: 10, Vampire2: 40, Vampire3: 50 };
        }
    }

    getRandomEnemyType(level) {
        const weights = this.getEnemySpawnWeights(level);
        const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
        let rnd = Phaser.Math.Between(1, totalWeight);
        for (const [type, weight] of Object.entries(weights)) {
            if (rnd <= weight) return type;
            rnd -= weight;
        }
        return "Vampire1"; // fallback
    }



    getEnemyStats(type) {
        switch (type) {
            case "Vampire1": return { hp: 2, speed: 50, type: "Vampire1" };
            case "Vampire2": return { hp: 1, speed: 120, type: "Vampire2" };
            case "Vampire3": return { hp: 4, speed: 40, type: "Vampire3" };
        }
    }

    updateScore(additionalScore) {
        console.log("adding score:", additionalScore)
        this.score += additionalScore;
        console.log("New Score: ", this.score);
        this.scoreText.setText(`Blood Points: ${this.score}`);
    }

    nextLevel() {
        if (this.player.currentRunSound) {
            this.sound.stopByKey(this.player.currentRunSound);
            this.player.currentRunSound = null;
        }

        this.elapsedTime = 0;
        const nextLevelDelay = 8000;

        // Kill enemies
        this.enemies.children.iterate(enemy => {
            enemy.die(false)
        });

        // Stop spawning
        if (this.spawnLoop) this.spawnLoop.remove();
        this.levelComplete = true;


        // Show overlay
        this.updateScore((100 * this.level));
        const levelText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            `LEVEL ${this.level} COMPLETE!\nNext Level starts in a few seconds.`,
            {
                fontSize: '32px',
                fill: '#ff0',
                align: 'center',
                wordWrap: { width: this.cameras.main.width * 0.8 }
            }
        )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(999);



        // Start next level after delay
        this.time.delayedCall(nextLevelDelay, () => {
            levelText.destroy();
            this.startNextLevel();
        });

    }

    startNextLevel() {
        this.levelComplete = false;

        this.elapsedTime = 0;
        this.levelTime += 10;
        this.level++;
        this.currentLevelText.setText(`Level: ${this.level}`);
        this.spawnLoop = this.time.addEvent({
            delay: Math.max(2000, 10000 - this.level * 1000),
            loop: true,
            callback: () => this.dynamicEnemySpawn()
        });
    }

    showGameOverScreen() {
        // Prevent further updates
        this.levelComplete = true;
        if (this.spawnLoop) this.spawnLoop.remove();
        this.updateScore(Math.round(this.survivalTime));
        // const gameOverText = this.add.text(
        //     this.cameras.main.centerX,
        //     this.cameras.main.centerY,
        //     `GAME OVER! Your Score: ${this.score}\nPress ENTER to return to menu.`,
        //     {
        //         fontSize: '48px',
        //         fill: '#ff0000',
        //         align: 'center',
        //         wordWrap: { width: this.cameras.main.width * 0.8 }
        //     }
        // ).setOrigin(0.5).setScrollFactor(0).setDepth(999);

        // this.input.keyboard.once('keydown-ENTER', () => {
        //     this.scene.stop();
        //     this.cleanupScene()
        //     this.scene.start("StartScene");

        // });

        const score = this.score;
        const timeSurvived = Math.round(this.survivalTime);
        const level = this.level;
        const kills = this.enemiesKilled;
        const bloodCrystals1 = this.bloodCrystals1;
        const bloodCrystals2 = this.bloodCrystals2;
        const bloodCrystals3 = this.bloodCrystals3;
        const mysteryBuffs = this.mysteryBuffs;
        const mysteryNerfs = this.mysteryNerfs;
        const weatherCount = this.weatherCount;
        this.scene.stop();
        this.physics.world.colliders.destroy();
        this.cleanupScene();
        this.scene.start("ScoreOverviewScene", {
            score,
            timeSurvived,
            level,
            kills,
            bloodCrystals1,
            bloodCrystals2,
            bloodCrystals3,
            mysteryBuffs,
            mysteryNerfs,
            weatherCount
        })


    }

    cleanupScene() {
        this.ready = false;
        this.levelComplete = false;
        this.elapsedTime = 0;
        this.survivalTime = 0;
        this.levelTime = 30;
        this.level = 1;
        this.score = 0;
        if (this.spawnLoop) this.spawnLoop.remove();
        if (this.mysteryCrystalLoop) this.mysteryCrystalLoop.remove();
        if (this.enemies) this.enemies.clear(true, true);
        if (this.player) this.player.destroy();
        if (this.map) {
            this.map.destroy();
            this.map = null;
        }
        if (this.layers) {
            Object.values(this.layers).forEach(layer => layer.destroy());
        }
        if (this.weatherEffects) this.weatherEffects.destroy?.();
        this.children.removeAll();  // removes all GameObjects
    }



    setupCamera() {
        this.cameras.main.setZoom(1.2);
        this.cameras.main.startFollow(this.player);
        this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.setRoundPixels(true);
    }

    setupInput() {
        this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.cursors = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });
        this.player.hp = 5;
        this.canAttack = true;
        this.player.isAttacking = false;
    }

    collectCrystal(player, crystal) {
        this.sound.play('shard_collect', { volume: 0.5 });
        crystal.destroy();
        console.log(`Collected ${crystal.shardType} shard`);

        if (crystal.shardType === 'Vampire1') {
            player.hp = Math.min(player.hp + 1, 5); // heal up to max 5 HP
            this.bloodCrystals1 += 1;
            this.hpText.setText(`HP: ${player.hp}`);
            this.showFloatingText(player.x, player.y, '+1 HP', '#ff3333');
        } else if (crystal.shardType === 'Vampire2') {
            this.bloodCrystals2 += 1;
            this.player.speed += 100;
            // Change back the speed to normal after 5 seconds
            this.time.delayedCall(10 * 1000, () => {
                this.player.speed -= 100;
            });
            this.showFloatingText(player.x, player.y, 'Speed Up!', '#ff8800');
        } else if (crystal.shardType === 'Vampire3') {
            this.bloodCrystals3 += 1;
            if (this.level <= 4) {
                this.applyAttackBuff();
                this.showFloatingText(player.x, player.y, 'Damage Up!', '#ff2222');
            } else {
                this.triggerAoEBlast();
                this.showFloatingText(player.x, player.y, 'Blast!', '#ff4444');
            }
        }
    }

    collectMysteryCrystal(player, crystal) {
        console.log('Collected mystery crystal');
        this.sound.play('shard_collect', { volume: 0.5 });
        crystal.destroy();


        const positiveEffects = ['massiveHeal', 'invincibility', 'speedFrenzy', 'multiAoE', 'clearEnemies'];
        const negativeEffects = ['hpDrop', 'speedLoss', 'enemyWave', 'freezePlayer', 'flipControls'];

        const isPositive = Phaser.Math.Between(0, 1) === 0;
        const effect = isPositive
            ? Phaser.Utils.Array.GetRandom(positiveEffects)
            : Phaser.Utils.Array.GetRandom(negativeEffects);

        console.log(`Mystery Effect: ${effect}`);
        let text = 'idk';
        if (isPositive) {
            this.updateScore(15);
            this.mysteryBuffs += 1;
        } else {
            this.updateScore(5);
            this.mysteryNerfs += 1;
        }

        switch (effect) {
            case 'massiveHeal':
                text = 'Massive Heal!';
                this.player.hp = Math.min(5, this.player.hp + 3);
                this.hpText.setText(`HP: ${this.player.hp}`);
                break;

            case 'invincibility':
                text = 'Invincibility!';
                this.player.invulnerable = true;
                this.tweens.add({
                    targets: this.player,
                    alpha: 0,
                    ease: 'Linear',
                    duration: 200,
                    repeat: 14,
                    yoyo: true,
                    onComplete: () => {
                        this.player.alpha = 1;
                        this.player.invulnerable = false;
                    }
                });
                break;

            case 'speedFrenzy':
                text = 'Speed++';
                this.player.speed = this.player.baseSpeed + 200;

                // Start cycling tint colors
                const colors = [0x00ffff, 0xff00ff, 0xffff00, 0xff6600]; // cyan, magenta, yellow, orange
                let colorIndex = 0;

                const colorTween = this.time.addEvent({
                    delay: 150, // change color every 150ms
                    callback: () => {
                        this.player.setTint(colors[colorIndex]);
                        colorIndex = (colorIndex + 1) % colors.length;
                    },
                    loop: true
                });

                this.time.delayedCall(7000, () => {
                    this.player.speed = this.player.baseSpeed;
                    this.player.clearTint();
                    colorTween.remove(); // stop the color cycling
                });
                break;



            case 'multiAoE':
                text = 'AoE Blast!';
                for (let i = 0; i < 5; i++) {
                    this.time.delayedCall(i * 1000, () => this.triggerAoEBlast());
                }
                break;

            case 'clearEnemies':
                text = 'Enemies Cleared!';
                this.enemies.children.iterate(enemy => enemy?.die?.(false));
                break;

            case 'hpDrop':
                text = 'HP -2';
                this.player.hp = Math.max(0, this.player.hp - 2);
                break;

            case 'speedLoss':
                text = 'Speed--';
                this.player.speed = Math.max(50, this.player.speed - 100);

                // Pulsating blue tint (fade between normal and blue)
                const pulseTween = this.tweens.add({
                    targets: this.player,
                    duration: 500,
                    repeat: -1,
                    yoyo: true,
                    tint: { from: 0xffffff, to: 0x3399ff }  // Light blue
                });

                this.time.delayedCall(7000, () => {
                    this.player.speed += 100;
                    this.player.clearTint();
                    pulseTween.stop();
                });
                break;


            case 'enemyWave':
                text = 'Enemy Wave!';
                for (let i = 0; i < 5; i++) this.dynamicEnemySpawn();
                break;

            case 'freezePlayer':
                text = 'Freeze';
                this.player.setTint(0x9999ff);
                this.player.frozen = true;
                this.time.delayedCall(3000, () => {
                    this.player.frozen = false;
                    this.player.clearTint();
                });
                break;

            case 'flipControls':
                text = 'Controls Flipped!';
                this.player.flippedControls = true;
                this.player.setTint(0xff00ff);
                this.time.delayedCall(7000, () => {
                    this.player.flippedControls = false;
                    this.player.clearTint();
                });
                break;
        }
        this.showFloatingText(this.player.x, this.player.y, text, isPositive ? '#00ff00' : '#ff0000');
    }

    applyAttackBuff() {
        console.log('Attack buff applied');
        this.player.attackMultiplier = 2;  // 2x damage
        this.time.delayedCall(5000, () => {
            this.player.attackMultiplier = 1;
            console.log('Attack buff expired');
        });

        this.tweens.add({
            targets: this.player,
            tint: 0xff4444,
            yoyo: true,
            repeat: 9,
            duration: 250
        });
    }

    triggerAoEBlast() {
        console.log('AoE blast triggered!');
        const blastRadius = 100;
        const player = this.player;

        const circle = this.add.circle(player.x, player.y, blastRadius, 0xff3333, 0.3).setDepth(1000);
        this.time.delayedCall(300, () => circle.destroy());

        this.enemies.children.iterate(enemy => {
            if (enemy.active) {
                const distance = Phaser.Math.Distance.Between(player.x, player.y, enemy.x, enemy.y);
                if (distance <= blastRadius) {
                    enemy.takeDamage(3);
                }
            }
        });
    }

    showFloatingText(x, y, text, color = '#ffffff') {
        const txt = this.add.text(x, y - 20, text, {
            font: '16px Arial',
            fill: color
        }).setDepth(999);

        this.tweens.add({
            targets: txt,
            y: y - 60,
            alpha: 0,
            duration: 1000,
            onComplete: () => txt.destroy()
        });
    }

    spawnMysteryCrystal() {
        if (!this.scene.isActive()) return; // Don't spawn if scene inactive
        const pos = this.getRandomValidTile();
        if (!pos) return;
        const crystal = new MysteryCrystal(this, pos.x, pos.y);
        this.mysteryCrystals.add(crystal);
        this.physics.add.collider(crystal, this.layers.collisions);

        const initialInterval = 50000; // Start at 50 seconds
        const minInterval = 20000;     // Never faster than 20 seconds
        const duration = 4 * 60 * 1000;       // 4 minutes to reach min
        const elapsed = this.elapsedTime * 1000;

        const nextDelay = Math.max(
            minInterval,
            initialInterval - ((initialInterval - minInterval) * (elapsed / duration))
        );
        this.mysteryCrystalLoop.delay = nextDelay; // Adjust the delay for next spawn

    }

    loadAnimations(scene) {
        scene.anims.create({
            key: "vampire1_walk_down",
            frames: scene.anims.generateFrameNumbers("vampire1_walk", { start: 0, end: 5 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire1_walk_up",
            frames: scene.anims.generateFrameNumbers("vampire1_walk", { start: 6, end: 11 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire1_walk_left",
            frames: scene.anims.generateFrameNumbers("vampire1_walk", { start: 12, end: 17 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire1_walk_right",
            frames: scene.anims.generateFrameNumbers("vampire1_walk", { start: 18, end: 23 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire1_run_down",
            frames: scene.anims.generateFrameNumbers("vampire1_run", { start: 0, end: 7 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire1_run_up",
            frames: scene.anims.generateFrameNumbers("vampire1_run", { start: 8, end: 15 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire1_run_left",
            frames: scene.anims.generateFrameNumbers("vampire1_run", { start: 16, end: 23 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire1_run_right",
            frames: scene.anims.generateFrameNumbers("vampire1_run", { start: 24, end: 31 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire1_idle_down",
            frames: scene.anims.generateFrameNumbers("vampire1_idle", { start: 0, end: 3 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire1_idle_up",
            frames: scene.anims.generateFrameNumbers("vampire1_idle", { start: 4, end: 7 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire1_idle_left",
            frames: scene.anims.generateFrameNumbers("vampire1_idle", { start: 8, end: 11 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire1_idle_right",
            frames: scene.anims.generateFrameNumbers("vampire1_idle", { start: 12, end: 15 }),
            frameRate: 10,
            repeat: -1
        });

        scene.anims.create({
            key: "vampire1_attack_down",
            frames: scene.anims.generateFrameNumbers("vampire1_attack", { start: 0, end: 11 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire1_attack_up",
            frames: scene.anims.generateFrameNumbers("vampire1_attack", { start: 12, end: 23 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire1_attack_left",
            frames: scene.anims.generateFrameNumbers("vampire1_attack", { start: 24, end: 35 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire1_attack_right",
            frames: scene.anims.generateFrameNumbers("vampire1_attack", { start: 36, end: 43 }),
            frameRate: 10,
            repeat: -1
        });

        scene.anims.create({
            key: "vampire1_death",
            frames: scene.anims.generateFrameNumbers("vampire1_death", { start: 0, end: 10 }),
            frameRate: 10,
            repeat: 0
        });
        scene.anims.create({
            key: "vampire1_hurt_down",
            frames: scene.anims.generateFrameNumbers("vampire1_hurt", { start: 0, end: 3 }),
            frameRate: 10,
            repeat: 0
        });
        scene.anims.create({
            key: "vampire1_hurt_up",
            frames: scene.anims.generateFrameNumbers("vampire1_hurt", { start: 4, end: 7 }),
            frameRate: 10,
            repeat: 0
        });
        scene.anims.create({
            key: "vampire1_hurt_left",
            frames: scene.anims.generateFrameNumbers("vampire1_hurt", { start: 8, end: 11 }),
            frameRate: 10,
            repeat: 0
        });
        scene.anims.create({
            key: "vampire1_hurt_right",
            frames: scene.anims.generateFrameNumbers("vampire1_hurt", { start: 12, end: 15 }),
            frameRate: 10,
            repeat: 0
        });

        // Load vampire 2 animations
        scene.anims.create({
            key: "vampire2_walk_down",
            frames: scene.anims.generateFrameNumbers("vampire2_walk", { start: 0, end: 5 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire2_walk_up",
            frames: scene.anims.generateFrameNumbers("vampire2_walk", { start: 6, end: 11 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire2_walk_left",
            frames: scene.anims.generateFrameNumbers("vampire2_walk", { start: 12, end: 17 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire2_walk_right",
            frames: scene.anims.generateFrameNumbers("vampire2_walk", { start: 18, end: 23 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire2_run_down",
            frames: scene.anims.generateFrameNumbers("vampire2_run", { start: 0, end: 7 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire2_run_up",
            frames: scene.anims.generateFrameNumbers("vampire2_run", { start: 8, end: 15 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire2_run_left",
            frames: scene.anims.generateFrameNumbers("vampire2_run", { start: 16, end: 23 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire2_run_right",
            frames: scene.anims.generateFrameNumbers("vampire2_run", { start: 24, end: 31 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire2_idle_down",
            frames: scene.anims.generateFrameNumbers("vampire2_idle", { start: 0, end: 3 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire2_idle_up",
            frames: scene.anims.generateFrameNumbers("vampire2_idle", { start: 4, end: 7 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire2_idle_left",
            frames: scene.anims.generateFrameNumbers("vampire2_idle", { start: 8, end: 11 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire2_idle_right",
            frames: scene.anims.generateFrameNumbers("vampire2_idle", { start: 12, end: 15 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire2_attack_down",
            frames: scene.anims.generateFrameNumbers("vampire2_attack", { start: 0, end: 11 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire2_attack_up",
            frames: scene.anims.generateFrameNumbers("vampire2_attack", { start: 12, end: 23 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire2_attack_left",
            frames: scene.anims.generateFrameNumbers("vampire2_attack", { start: 24, end: 35 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire2_attack_right",
            frames: scene.anims.generateFrameNumbers("vampire2_attack", { start: 36, end: 43 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire2_death",
            frames: scene.anims.generateFrameNumbers("vampire2_death", { start: 0, end: 10 }),
            frameRate: 10,
            repeat: 0
        });
        scene.anims.create({
            key: "vampire2_hurt_down",
            frames: scene.anims.generateFrameNumbers("vampire2_hurt", { start: 0, end: 3 }),
            frameRate: 10,
            repeat: 0
        });
        scene.anims.create({
            key: "vampire2_hurt_up",
            frames: scene.anims.generateFrameNumbers("vampire2_hurt", { start: 4, end: 7 }),
            frameRate: 10,
            repeat: 0
        });
        scene.anims.create({
            key: "vampire2_hurt_left",
            frames: scene.anims.generateFrameNumbers("vampire2_hurt", { start: 8, end: 11 }),
            frameRate: 10,
            repeat: 0
        });
        scene.anims.create({
            key: "vampire2_hurt_right",
            frames: scene.anims.generateFrameNumbers("vampire2_hurt", { start: 12, end: 15 }),
            frameRate: 10,
            repeat: 0
        });
        // Load vampire 3 animations
        scene.anims.create({
            key: "vampire3_walk_down",
            frames: scene.anims.generateFrameNumbers("vampire3_walk", { start: 0, end: 5 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire3_walk_up",
            frames: scene.anims.generateFrameNumbers("vampire3_walk", { start: 6, end: 11 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire3_walk_left",
            frames: scene.anims.generateFrameNumbers("vampire3_walk", { start: 12, end: 17 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire3_walk_right",
            frames: scene.anims.generateFrameNumbers("vampire3_walk", { start: 18, end: 23 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire3_run_down",
            frames: scene.anims.generateFrameNumbers("vampire3_run", { start: 0, end: 7 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire3_run_up",
            frames: scene.anims.generateFrameNumbers("vampire3_run", { start: 8, end: 15 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire3_run_left",
            frames: scene.anims.generateFrameNumbers("vampire3_run", { start: 16, end: 23 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire3_run_right",
            frames: scene.anims.generateFrameNumbers("vampire3_run", { start: 24, end: 31 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire3_idle_down",
            frames: scene.anims.generateFrameNumbers("vampire3_idle", { start: 0, end: 3 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire3_idle_up",
            frames: scene.anims.generateFrameNumbers("vampire3_idle", { start: 4, end: 7 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire3_idle_left",
            frames: scene.anims.generateFrameNumbers("vampire3_idle", { start: 8, end: 11 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire3_idle_right",
            frames: scene.anims.generateFrameNumbers("vampire3_idle", { start: 12, end: 15 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire3_attack_down",
            frames: scene.anims.generateFrameNumbers("vampire3_attack", { start: 0, end: 11 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire3_attack_up",
            frames: scene.anims.generateFrameNumbers("vampire3_attack", { start: 12, end: 23 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire3_attack_left",
            frames: scene.anims.generateFrameNumbers("vampire3_attack", { start: 24, end: 35 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire3_attack_right",
            frames: scene.anims.generateFrameNumbers("vampire3_attack", { start: 36, end: 43 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire3_death",
            frames: scene.anims.generateFrameNumbers("vampire3_death", { start: 0, end: 10 }),
            frameRate: 10,
            repeat: 0
        });
        scene.anims.create({
            key: "vampire3_hurt_down",
            frames: scene.anims.generateFrameNumbers("vampire3_hurt", { start: 0, end: 3 }),
            frameRate: 10,
            repeat: 0
        });
        scene.anims.create({
            key: "vampire3_hurt_up",
            frames: scene.anims.generateFrameNumbers("vampire3_hurt", { start: 4, end: 7 }),
            frameRate: 10,
            repeat: 0
        });
        scene.anims.create({
            key: "vampire3_hurt_left",
            frames: scene.anims.generateFrameNumbers("vampire3_hurt", { start: 8, end: 11 }),
            frameRate: 10,
            repeat: 0
        });
        scene.anims.create({
            key: "vampire3_hurt_right",
            frames: scene.anims.generateFrameNumbers("vampire3_hurt", { start: 12, end: 15 }),
            frameRate: 10,
            repeat: 0
        });

        // Crystals
        scene.anims.create({
            key: 'crystal_spin',
            frames: this.anims.generateFrameNumbers('blood_crystal', { start: 0, end: 7 }),
            frameRate: 1,
            repeat: -1
        });

        this.areAnimationsLoaded = true;
    }

    loadPlayerAnimations(scene) {
        const directions = ['up', 'down', 'left', 'right'];

        for (const dir of directions) {
            scene.anims.create({
                key: `player-idle-${dir}`,
                frames: scene.anims.generateFrameNumbers(`main_idle_${dir}`, { start: 0, end: 7 }),
                frameRate: 6,
                repeat: -1
            });

            scene.anims.create({
                key: `player-run-${dir}`,
                frames: scene.anims.generateFrameNumbers(`main_run_${dir}`, { start: 0, end: 7 }),
                frameRate: 10,
                repeat: -1
            });

            scene.anims.create({
                key: `player-attack-${dir}`,
                frames: scene.anims.generateFrameNumbers(`main_attack_${dir}`, { start: 0, end: 7 }),
                frameRate: 10,
                repeat: 0
            });
        }

        for (const dir of directions) {
            scene.anims.create({
                key: `player2-idle-${dir}`,
                frames: scene.anims.generateFrameNumbers(`main2_idle_${dir}`, { start: 0, end: 7 }),
                frameRate: 6,
                repeat: -1
            });

            scene.anims.create({
                key: `player2-run-${dir}`,
                frames: scene.anims.generateFrameNumbers(`main2_run_${dir}`, { start: 0, end: 7 }),
                frameRate: 10,
                repeat: -1
            });

            scene.anims.create({
                key: `player2-attack-${dir}`,
                frames: scene.anims.generateFrameNumbers(`main2_attack_${dir}`, { start: 0, end: 7 }),
                frameRate: 10,
                repeat: 0
            });
        }

    }
}
