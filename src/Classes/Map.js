// BaseMap.js
import Phaser from "phaser";
import EasyStar from "easystarjs";
import Enemy from "./Enemy";
import { ApiManager } from "./ApiManager";
import { WeatherEffectManager } from './WeatherEffectManager';


const MELEE_RANGE = 45;
const ENEMY_MELEE_RANGE = 32;

export class Map extends Phaser.Scene {
    constructor(config) {
        super({ key: config.key });
        this.mapKey = config.mapKey;
        this.tilesets = config.tilesets;
        this.apiManager = new ApiManager(this);
        this.ready = false;
        this.started = false;
        this.startKey = null;
        this.levelComplete = false;





        // Level and time
        this.levelTime = 30; // 30 seconds survival time for level one.
        this.elapsedTime = 0;
        this.level = 1;

    }

    preload() {
        if (this.cache.tilemap.exists(this.mapKey)) this.cache.tilemap.remove(this.mapKey);
        this.tilesets.forEach(ts => {
            if (this.textures.exists(ts.imageKey)) this.textures.remove(ts.imageKey);
        });

        this.load.tilemapTiledJSON(this.mapKey, `assets/${this.mapKey}.json`);
        this.tilesets.forEach(ts => {
            this.load.image(ts.imageKey, ts.imagePath);
        });
        this.loadAnimationSpriteSheets();
    }



    async create() {

        const map = this.make.tilemap({ key: this.mapKey });
        this.map = map;
        this.easystar = new EasyStar.js();
        this.easystar.setIterationsPerCalculation(20);
        // Load tilesets
        this.weatherText = this.add.text(100, 50, ``, { fontSize: '14px', fill: '#fff' }).setScrollFactor(0);
        this.hpText = this.add.text(100, 80, "HP: 5", { fontSize: "16px", fill: "#fff" }).setScrollFactor(0);
        this.speedText = this.add.text(10, 30, "", { fontSize: "14px", fill: "#fff" }).setScrollFactor(0).setDepth(999);
        this.currentLevelText = this.add.text(100, 140, `Level: ${this.level}`, { fontSize: '14px', fill: '#fff' }).setScrollFactor(0).setDepth(999);
        this.timerText = this.add.text(100, 110, `Time Left: ${this.levelTime}`, { fontSize: '18px', fill: '#fff' }).setScrollFactor(0).setDepth(999);

        const tilesetObjs = this.tilesets.map(ts => map.addTilesetImage(ts.name, ts.imageKey));
        this.apiManager = new ApiManager(this);
        this.startKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);


        this.spawnPlayer();
        this.setupInput();

        this.createLayers(map, tilesetObjs);

        this.setupCamera();
        this.setupObstacles();
        this.spawnEnemies();
        this.weatherEffects = new WeatherEffectManager(this, this.apiManager);
        await this.apiManager.init();
        this.weatherText.setText(`Weather: Loading...`);
        this.weatherEffects.apply();
        if (!this.anims.exists('player-idle-up')) {
            this.loadPlayerAnimations(this);
            this.loadAnimations(this);
        }

        this.physics.add.collider(this.player, this.enemies);
        this.physics.add.collider(this.player, this.layers.collisions);

        this.hpText.setDepth(999);
        this.weatherText.setDepth(999);
        this.speedText.setDepth(999);

        // Crystals
        this.crystals = this.physics.add.group();



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

        this.ready = true;
    }

    update() {
        if (this.levelComplete) {
            if (!this.player.isDead) {
                this.player.setVelocity(0);
                this.player.anims.play(`player-idle-${this.player.direction}`, true);
            }
            return;
        }
        if (!this.started) {
            if (Phaser.Input.Keyboard.JustDown(this.startKey)) {
                console.log("Starting game logic...");
                this.startGame();
            }
            return;
        }

        if (!this.ready) return;
        this.elapsedTime += this.game.loop.delta / 1000;
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

        if (Phaser.Input.Keyboard.JustDown(this.attackKey) && !this.beingHit && this.canAttack && !this.player.isAttacking) {
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
        if (!this.player.isAttacking && this.time.now > (this.player.hurtUntil || 0)) {
            if (this.cursors.left.isDown) {
                this.player.setVelocityX(-speed);
                this.player.anims.play("player-run-left", true);
                this.player.direction = "left";
            } else if (this.cursors.right.isDown) {
                this.player.setVelocityX(speed);
                this.player.anims.play("player-run-right", true);
                this.player.direction = "right";
            } else if (this.cursors.up.isDown) {
                this.player.setVelocityY(-speed);
                this.player.anims.play("player-run-up", true);
                this.player.direction = "up";
            } else if (this.cursors.down.isDown) {
                this.player.setVelocityY(speed);
                this.player.anims.play("player-run-down", true);
                this.player.direction = "down";
            } else {
                this.player.anims.play(`player-idle-${this.player.direction}`, true);
            }
        } else {
            this.player.setVelocity(0);
        }

        this.enemies.children.iterate(enemy => {
            if (!enemy.active) return;
            if (!enemy.body) return;

            enemy.update(this.time.now, this.player);
            const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
            if (distance < MELEE_RANGE && this.player.isAttacking) enemy.takeDamage(1);

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
                        this.player.hp--;
                        this.player.invulnerable = true;
                        this.player.setTint(0xff0000);
                        const knockback = new Phaser.Math.Vector2(this.player.x - enemy.x, this.player.y - enemy.y).normalize().scale(200);
                        this.player.body.velocity.add(knockback);

                        this.time.delayedCall(100, () => this.player.clearTint());
                        this.time.delayedCall(1000, () => this.player.invulnerable = false);
                        if (this.player.hp <= 0) {
                            this.player.isDead = true;
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

    loadAnimationSpriteSheets() {
        const dirs = ['up', 'down', 'left', 'right'];

        // Load player animations
        dirs.forEach(dir => {
            this.load.spritesheet(`main_run_${dir}`, `assets/Sprite/Main/RUN/run_${dir}.png`, { frameWidth: 96, frameHeight: 80 });
            this.load.spritesheet(`main_idle_${dir}`, `assets/Sprite/Main/IDLE/idle_${dir}.png`, { frameWidth: 96, frameHeight: 80 });
            this.load.spritesheet(`main_attack_${dir}`, `assets/Sprite/Main/ATTACK/attack1_${dir}.png`, { frameWidth: 96, frameHeight: 80 });
        });

        // Load vampire 1
        this.load.spritesheet("vampire1_walk", "assets/Sprite/Vampires1/Walk/Vampires1_Walk_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_run", "assets/Sprite/Vampires1/Run/Vampires1_Run_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_idle", "assets/Sprite/Vampires1/Idle/Vampires1_Idle_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_attack", "assets/Sprite/Vampires1/Attack/Vampires1_Attack_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_death", "assets/Sprite/Vampires1/Death/Vampires1_Death_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_hurt", "assets/Sprite/Vampires1/Hurt/Vampires1_Hurt_full.png", { frameWidth: 64, frameHeight: 64 });

        // Load vampire 2
        this.load.spritesheet("vampire2_walk", "assets/Sprite/Vampires2/Walk/Vampires2_Walk_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire2_run", "assets/Sprite/Vampires2/Run/Vampires2_Run_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire2_idle", "assets/Sprite/Vampires2/Idle/Vampires2_Idle_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire2_attack", "assets/Sprite/Vampires2/Attack/Vampires2_Attack_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire2_death", "assets/Sprite/Vampires2/Death/Vampires2_Death_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire2_hurt", "assets/Sprite/Vampires2/Hurt/Vampires2_Hurt_full.png", { frameWidth: 64, frameHeight: 64 });

        // Load vampire 3
        this.load.spritesheet("vampire3_walk", "assets/Sprite/Vampires3/Walk/Vampires3_Walk_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire3_run", "assets/Sprite/Vampires3/Run/Vampires3_Run_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire3_idle", "assets/Sprite/Vampires3/Idle/Vampires3_Idle_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire3_attack", "assets/Sprite/Vampires3/Attack/Vampires3_Attack_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire3_death", "assets/Sprite/Vampires3/Death/Vampires3_Death_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire3_hurt", "assets/Sprite/Vampires3/Hurt/Vampires3_Hurt_full.png", { frameWidth: 64, frameHeight: 64 });

        // Load blood crystal
        this.load.spritesheet("blood_crystal", "assets/Items/BloodCrystal.png", { frameWidth: 256, frameHeight: 256 });
    }

    startGame() {
        if (this.enemies) this.enemies.clear(true, true);

        this.started = true;
        this.elapsedTime = 0;
        this.level = 1;

        if (this.spawnLoop) this.spawnLoop.remove();
        this.spawnLoop = this.time.addEvent({
            delay: 10000,
            loop: true,
            callback: () => this.dynamicEnemySpawn()
        });
        this.spawnEnemies();

        // Spawn immunity
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
        this.player.setSize(8, 4);
        this.player.setDepth(3);
        this.player.isDead = false;


    }

    spawnEnemies() {
        const spawnerObjects = this.map.getObjectLayer("Spawners").objects;
        this.enemies = this.physics.add.group();
        spawnerObjects.forEach(obj => {
            const enemy = new Enemy(this, obj.x, obj.y, "Vampire1", {
                hp: 1, speed: 50, type: "Vampire1", x: 8, y: 8
            });
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
            const enemy = new Enemy(this, x, y, type, this.getEnemyStats(type));

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
            case "Vampire2": return { hp: 1, speed: 100, type: "Vampire2" };
            case "Vampire3": return { hp: 4, speed: 40, type: "Vampire3" };
        }
    }

    nextLevel() {
        this.elapsedTime = 0;
        const nextLevelDelay = 8000;

        // Kill enemies
        this.enemies.children.iterate(enemy => {
            enemy.die()
        });

        // Stop spawning
        if (this.spawnLoop) this.spawnLoop.remove();
        this.levelComplete = true;


        // Show overlay
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

        const gameOverText = this.add.text(
            this.cameras.main.centerX,
            this.cameras.main.centerY,
            `GAME OVER\nPress ENTER to Restart`,
            {
                fontSize: '48px',
                fill: '#ff0000',
                align: 'center',
                wordWrap: { width: this.cameras.main.width * 0.8 }
            }
        ).setOrigin(0.5).setScrollFactor(0).setDepth(999);

        this.input.keyboard.once('keydown-ENTER', () => {
            location.reload(); // Reload the page lmao

        });

    }

    cleanupScene() {
        this.ready = false;
        this.started = false;
        this.levelComplete = false;

        if (this.spawnLoop) this.spawnLoop.remove();
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
        crystal.destroy();
        console.log("Collected a Blood Crystal!");
        // Optional: add effects, score, health regen, etc
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
            frames: this.anims.generateFrameNumbers('blood_crystal', { start: 0, end: 15 }),
            frameRate: 10,
            repeat: -1
        });


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

    }
}
