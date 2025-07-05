// Import Phaser and EasyStar
import Phaser from "phaser";
import EasyStar from "easystarjs";
import Enemy from "./Classes/Enemy";


export class SceneMain extends Phaser.Scene {
    constructor() {
        super("SceneMain");
        this.beingHit = false;
    }

    preload() {
        const color = "Red";
        // Load tileset images
        this.load.image("tileset", "assets/tileset_arranged.png"); // tileset_arranged
        this.load.image("objects", "assets/obstacles-and-objects.png");
        this.load.spritesheet("main", `assets/Sprite/Soldier-${color}.png`, { frameWidth: 32, frameHeight: 32 });


        this.load.spritesheet("vampire1_walk", "assets/Sprite/Vampires1/Walk/Vampires1_Walk_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_run", "assets/Sprite/Vampires1/Run/Vampires1_Run_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_idle", "assets/Sprite/Vampires1/Idle/Vampires1_Idle_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_attack", "assets/Sprite/Vampires1/Attack/Vampires1_Attack_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_death", "assets/Sprite/Vampires1/Death/Vampires1_Death_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_hurt", "assets/Sprite/Vampires1/Hurt/Vampires1_Hurt_full.png", { frameWidth: 64, frameHeight: 64 });


        // Load Tiled map
        this.load.tilemapTiledJSON("map", "assets/arena1.json");

        this.input.keyboard.on("keydown-ENTER", () => {
            document.getElementById("overlay").style.display = "none";
            document.getElementById("game-container").style.display = "block";
            console.log("Game Starting...");
        });
    }

    create() {


        // Create tilemap
        const map = this.make.tilemap({ key: "map" });
        this.map = map;


        // Add tilesets (names must match those used in Tiled)
        const tilesetA = map.addTilesetImage("tileset_arranged", "tileset");
        const tilesetB = map.addTilesetImage("obstacles-and-objects", "objects");

        // Create layers
        const background = map.createLayer("Background", tilesetA, 0, 0);
        const collisions = map.createLayer("Collisions", [tilesetA, tilesetB], 0, 0);
        const overhead = map.createLayer("Overhead", tilesetB, 0, 0);

        this.player = this.physics.add.sprite(400, 200, 'main', 0).setSize(16, 10);
        this.player.setCollideWorldBounds(true);

        this.cameras.main.setZoom(1.5);
        this.cameras.main.startFollow(this.player);

        background.setDepth(0);
        collisions.setDepth(1);
        overhead.setDepth(3);
        this.player.setDepth(2);

        this.player.setSize(8, 4);

        this.debugGraphics = this.add.graphics().setDepth(10);



        // Optional: collisions
        collisions.setCollisionByExclusion([-1]);

        // World & camera bounds
        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.cameras.main.centerOn(map.widthInPixels / 2, map.heightInPixels / 2);

        // Collisions
        this.physics.add.collider(this.player, collisions);


        const spawnerObjects = map.getObjectLayer("Spawners").objects;

        this.enemies = this.physics.add.group();

        spawnerObjects.forEach((spawnObj) => {

            const enemy = new Enemy(this, spawnObj.x, spawnObj.y, "Vampire1", {
                hp: 3,
                speed: 50,
                type: 'Vampire1',
                x: 8,
                y: 8
            });

            this.enemies.add(enemy);
            this.physics.add.collider(enemy, collisions);
        });

        // Obstacles
        this.obstacles = this.physics.add.staticGroup();

        // Automatically gather all solid tiles from the "Collisions" layer
        this.map.getLayer("Collisions").tilemapLayer.forEachTile((tile) => {
            if (tile.index !== -1) {
                const worldX = this.map.tileToWorldX(tile.x) + this.map.tileWidth / 2;
                const worldY = this.map.tileToWorldY(tile.y) + this.map.tileHeight / 2;
                const obstacle = this.obstacles.create(worldX, worldY, null).setSize(this.map.tileWidth, this.map.tileHeight);
                obstacle.visible = false; // Invisible collider
            }
        });




        this.player.hp = 5;

        // Input
        this.cursors = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        this.anims.create({
            key: "walk-down",
            frames: this.anims.generateFrameNumbers("main", { start: 0, end: 3 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: "walk-up",
            frames: this.anims.generateFrameNumbers("main", { start: 96, end: 99 }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: "walk-left",
            frames: this.anims.generateFrameNumbers("main", { start: 144, end: 147 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: "walk-right",
            frames: this.anims.generateFrameNumbers("main", { start: 48, end: 51 }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: "player-hurt-down",
            frames: this.anims.generateFrameNumbers("main", { start: 15, end: 19 }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: "player-hurt-up",
            frames: this.anims.generateFrameNumbers("main", { start: 87, end: 91 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: "player-hurt-left",
            frames: this.anims.generateFrameNumbers("main", { start: 159, end: 163 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: "player-hurt-right",
            frames: this.anims.generateFrameNumbers("main", { start: 63, end: 67 }),
            frameRate: 10,
            repeat: -1
        });

        // Load animations
        this.loadAnimations(this);


        // Check if player is hit
        this.physics.add.collider(this.player, this.enemies);




        // Create HP text
        this.hpText = this.add.text(10, 10, "HP: 5", {
            fontSize: "16px",
            fill: "#fff"
        }).setScrollFactor(0);


    }

    update() {
        const speed = 150;
        const body = this.player.body;
        this.hpText.setText(`HP: ${this.player.hp}`);

        body.setVelocity(0);
            if (this.cursors.left.isDown) {
                this.player.setVelocityX(-speed);
                if (!this.beingHit)
                    this.player.anims.play("walk-left", true);
                this.player.direction = "left";
            } else if (this.cursors.right.isDown) {
                this.player.setVelocityX(speed);
                if (!this.beingHit)
                    this.player.anims.play("walk-right", true);
                this.player.direction = "right";
            } else if (this.cursors.up.isDown) {
                this.player.setVelocityY(-speed);
                if (!this.beingHit)
                    this.player.anims.play("walk-up", true);
                this.player.direction = "up";
            } else if (this.cursors.down.isDown) {
                this.player.setVelocityY(speed);
                if (!this.beingHit)
                    this.player.anims.play("walk-down", true);
                this.player.direction = "down";
            }
            else {  
                this.player.setVelocity(0);
                if (!this.beingHit)
                    this.player.anims.stop();
            }

        // DEBUG 
        // this.debugGraphics.clear();

        // this.enemies.children.iterate((enemy) => {
        //     if (!enemy.active) return;
        //     const now = this.time.now;
        //     enemy.drawDebugLines(now, this.debugGraphics, this.player);
        // });

        // this.debugGraphics.clear();
        // this.debugGraphics.lineStyle(1, 0xff0000);
        // this.debugGraphics.strokeRectShape(this.player.getBounds());

        // this.enemies.children.iterate((enemy) => {
        //     this.debugGraphics.strokeRectShape(enemy.getBounds());
        // });


        // Handle enemy wandering and chasing
        this.enemies.children.iterate((enemy) => {
            if (!enemy.active) return;

            enemy.update(this.time.now, this.player);

            const distance = Phaser.Math.Distance.Between(
                this.player.x, this.player.y,
                enemy.x, enemy.y
            );

            const inAttackRange = distance < 25;
            const now = this.time.now;

            if (inAttackRange && !enemy.hasHitPlayer && !this.player.invulnerable) {
                enemy.hasHitPlayer = true;
                enemy.playAnim("attack", 500);
                this.beingHit = true;

                this.time.delayedCall(400, () => {
                    if (
                        enemy.active && this.player.active &&
                        Phaser.Geom.Intersects.RectangleToRectangle(
                            this.player.getBounds(),
                            enemy.getBounds()
                        )
                    ) {
                        // Damage the player only once per attack cycle
                        this.player.hp--;
                        console.log("💢 Player hit! HP:", this.player.hp);

                        this.player.invulnerable = true;

                        // Hurt animation
                        const dir = this.player.direction || "down";
                        this.player.anims.stop();
                        this.player.anims.play(`player-hurt-${dir}`, true);

                        this.time.delayedCall(1000, () => {
                            this.player.invulnerable = false;
                            this.beingHit = false;
                        });

                        if (this.player.hp <= 0) {
                            this.player.setVelocity(0, 0);
                            this.player.disableBody(true, true);
                            this.beingHit = false;
                        }
                    }
                });

                // Reset enemy hit tracker after attack cooldown
                this.time.delayedCall(1000, () => {
                    enemy.hasHitPlayer = false;
                });
            }
        });

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
            repeat: -1
        });
        scene.anims.create({
            key: "vampire1_hurt_down",
            frames: scene.anims.generateFrameNumbers("vampire1_hurt", { start: 0, end: 3 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire1_hurt_up",
            frames: scene.anims.generateFrameNumbers("vampire1_hurt", { start: 4, end: 7 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire1_hurt_left",
            frames: scene.anims.generateFrameNumbers("vampire1_hurt", { start: 8, end: 11 }),
            frameRate: 10,
            repeat: -1
        });
        scene.anims.create({
            key: "vampire1_hurt_right",
            frames: scene.anims.generateFrameNumbers("vampire1_hurt", { start: 12, end: 15 }),
            frameRate: 10,
            repeat: -1
        });
    }
}