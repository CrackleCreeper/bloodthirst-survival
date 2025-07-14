// BaseMap.js
import Phaser from "phaser";
import EasyStar from "easystarjs";
import Enemy from "./Enemy";
import { ApiManager } from "./ApiManager";
import { WeatherEffectManager } from './WeatherEffectManager';


const MELEE_RANGE = 45;
const ENEMY_MELEE_RANGE = 20;

export class Map extends Phaser.Scene {
    constructor(config) {
        super({ key: config.key });
        this.mapKey = config.mapKey;
        this.tilesets = config.tilesets;
        this.apiManager = new ApiManager(this);
        this.ready = false;
    }

    preload() {
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
        const tilesetObjs = this.tilesets.map(ts => map.addTilesetImage(ts.name, ts.imageKey));
        this.apiManager = new ApiManager(this);



        this.spawnPlayer();
        this.setupInput();

        this.createLayers(map, tilesetObjs);

        this.setupCamera();
        this.setupObstacles();
        this.spawnEnemies();
        this.weatherEffects = new WeatherEffectManager(this, this.apiManager);
        await this.apiManager.init()
        const label = this.apiManager.getWeatherCode() === 2 ? 'Cloudy' : 'Clear';
        const temp = this.apiManager.getTemperature();
        this.weatherText.setText(`Weather: ${label} ${temp}°C`);
        this.weatherEffects.apply();
        this.loadPlayerAnimations(this);
        this.loadAnimations(this);
        this.physics.add.collider(this.player, this.enemies);
        this.physics.add.collider(this.player, this.layers.collisions);

        this.hpText.setDepth(999);
        this.weatherText.setDepth(999);
        this.speedText.setDepth(999);



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
        if (!this.ready) return;
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
                        this.time.delayedCall(100, () => this.player.clearTint());
                        this.time.delayedCall(1000, () => this.player.invulnerable = false);
                        if (this.player.hp <= 0) {
                            this.player.disableBody(true, true);
                            this.player.destroy();
                            this.spawnLoop.remove();
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
        dirs.forEach(dir => {
            this.load.spritesheet(`main_run_${dir}`, `assets/Sprite/Main/RUN/run_${dir}.png`, { frameWidth: 96, frameHeight: 80 });
            this.load.spritesheet(`main_idle_${dir}`, `assets/Sprite/Main/IDLE/idle_${dir}.png`, { frameWidth: 96, frameHeight: 80 });
            this.load.spritesheet(`main_attack_${dir}`, `assets/Sprite/Main/ATTACK/attack1_${dir}.png`, { frameWidth: 96, frameHeight: 80 });
        });
        this.load.spritesheet("vampire1_walk", "assets/Sprite/Vampires1/Walk/Vampires1_Walk_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_run", "assets/Sprite/Vampires1/Run/Vampires1_Run_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_idle", "assets/Sprite/Vampires1/Idle/Vampires1_Idle_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_attack", "assets/Sprite/Vampires1/Attack/Vampires1_Attack_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_death", "assets/Sprite/Vampires1/Death/Vampires1_Death_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_hurt", "assets/Sprite/Vampires1/Hurt/Vampires1_Hurt_full.png", { frameWidth: 64, frameHeight: 64 });
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
        this.player.setSize(8, 4);
        this.player.setDepth(3);
    }

    spawnEnemies() {
        const spawnerObjects = this.map.getObjectLayer("Spawners").objects;
        this.enemies = this.physics.add.group();
        spawnerObjects.forEach(obj => {
            const enemy = new Enemy(this, obj.x, obj.y, "Vampire1", {
                hp: 3, speed: 50, type: "Vampire1", x: 8, y: 8
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
        const btcPrice = this.apiManager.getBitcoinPrice(); // you'll need to expose this in your ApiManager
        const extraEnemies = Math.floor(btcPrice / 10000); // +1 enemy per $10k BTC

        for (let i = 0; i < 1 + extraEnemies; i++) {
            const { x, y } = this.getRandomValidTile();
            const enemy = new Enemy(this, x, y, "Vampire1", {
                hp: 3 + Math.floor(btcPrice / 20000), // stronger enemies if BTC high
                speed: 50,
                type: "Vampire1",
                x: 8, y: 8
            });
            this.enemies.add(enemy);
            this.physics.add.collider(enemy, this.layers.collisions);
        }
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
