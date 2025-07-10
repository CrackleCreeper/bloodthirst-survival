// Import Phaser and EasyStar
import Phaser from "phaser";
import EasyStar from "easystarjs";
import Enemy from "./Classes/Enemy";

const MELEE_RANGE = 45;
const ENEMY_MELEE_RANGE = 20;

export class SceneMain extends Phaser.Scene {
    constructor() {
        super("SceneMain");
        this.beingHit = false;
    }

    preload() {
        const color = "Red";
        // Load tileset images
        this.load.image("tileset", "assets/Texture/TX Tileset Grass.png"); // tileset_arranged
        this.load.image("objects", "assets/Texture/TX Tileset Wall.png");
        this.load.image("structure", "assets/Texture/TX Struct.png");
        this.load.image("plants", "assets/Texture/Extra/TX Plant with Shadow.png");
        this.load.image("props", "assets/Texture/Extra/TX Props with Shadow.png");
        this.load.image("concrete", "assets/Texture/TX Tileset Stone Ground.png");

        this.load.spritesheet("main_run_up", `assets/Sprite/Main/RUN/run_up.png`, { frameWidth: 96, frameHeight: 80 });
        this.load.spritesheet("main_run_down", `assets/Sprite/Main/RUN/run_down.png`, { frameWidth: 96, frameHeight: 80 });
        this.load.spritesheet("main_run_left", `assets/Sprite/Main/RUN/run_left.png`, { frameWidth: 96, frameHeight: 80 });
        this.load.spritesheet("main_run_right", `assets/Sprite/Main/RUN/run_right.png`, { frameWidth: 96, frameHeight: 80 });
        // Load idle animations
        this.load.spritesheet("main_idle_up", `assets/Sprite/Main/IDLE/idle_up.png`, { frameWidth: 96, frameHeight: 80 });
        this.load.spritesheet("main_idle_down", `assets/Sprite/Main/IDLE/idle_down.png`, { frameWidth: 96, frameHeight: 80 });
        this.load.spritesheet("main_idle_left", `assets/Sprite/Main/IDLE/idle_left.png`, { frameWidth: 96, frameHeight: 80 });
        this.load.spritesheet("main_idle_right", `assets/Sprite/Main/IDLE/idle_right.png`, { frameWidth: 96, frameHeight: 80 });
        // Load attack animations
        this.load.spritesheet("main_attack_up", `assets/Sprite/Main/ATTACK/attack1_up.png`, { frameWidth: 96, frameHeight: 80 });
        this.load.spritesheet("main_attack_down", `assets/Sprite/Main/ATTACK/attack1_down.png`, { frameWidth: 96, frameHeight: 80 });
        this.load.spritesheet("main_attack_left", `assets/Sprite/Main/ATTACK/attack1_left.png`, { frameWidth: 96, frameHeight: 80 });
        this.load.spritesheet("main_attack_right", `assets/Sprite/Main/ATTACK/attack1_right.png`, { frameWidth: 96, frameHeight: 80 });




        this.load.spritesheet("vampire1_walk", "assets/Sprite/Vampires1/Walk/Vampires1_Walk_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_run", "assets/Sprite/Vampires1/Run/Vampires1_Run_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_idle", "assets/Sprite/Vampires1/Idle/Vampires1_Idle_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_attack", "assets/Sprite/Vampires1/Attack/Vampires1_Attack_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_death", "assets/Sprite/Vampires1/Death/Vampires1_Death_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_hurt", "assets/Sprite/Vampires1/Hurt/Vampires1_Hurt_full.png", { frameWidth: 64, frameHeight: 64 });


        // Load Tiled map
        this.load.tilemapTiledJSON("map", "assets/Arena1_New.json");

        this.load.once('complete', () => {
            const json = this.cache.tilemap.get("map").data;
            console.log("Embedded Tileset Names:", json.tilesets.map(t => t.name));
        });

        this.input.keyboard.on("keydown-ENTER", () => {
            document.getElementById("overlay").style.display = "none";
            document.getElementById("game-container").style.display = "block";
            console.log("Game Starting...");
        });
        this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    }

    create() {


        // Create tilemap
        const map = this.make.tilemap({ key: "map" });
        console.log("Tileset names:", map.tilesets.map(ts => ts.name));

        this.map = map;
        // Add tilesets (names must match those used in Tiled)
        const tilesetA = map.addTilesetImage("Grass", "tileset");
        const tilesetB = map.addTilesetImage("Wall", "objects");
        const tilesetC = map.addTilesetImage("Structure", "structure");
        const tilesetD = map.addTilesetImage("Plants", "plants");
        const tilesetE = map.addTilesetImage("Props", "props");
        const tilesetF = map.addTilesetImage("Concrete", "concrete");

        // Create layers
        const background = map.createLayer("Background", [tilesetA, tilesetC, tilesetB, tilesetD, tilesetE, tilesetF], 0, 0);
        const collisions = map.createLayer("Collisions", [tilesetA, tilesetC, tilesetB, tilesetD, tilesetE, tilesetF], 0, 0);
        const shadows = map.createLayer("Shadows", [tilesetA, tilesetC, tilesetB, tilesetD, tilesetE, tilesetF], 0, 0);
        const overhead = map.createLayer("Overhead", [tilesetA, tilesetC, tilesetB, tilesetD, tilesetE, tilesetF], 0, 0);

        this.player = this.physics.add.sprite(400, 200, 'main_idle_down', 0).setScale(1);
        this.player.setCollideWorldBounds(true);

        this.cameras.main.setZoom(1.2);
        this.cameras.main.startFollow(this.player);

        background.setDepth(0);
        collisions.setDepth(2);
        shadows.setDepth(1);
        overhead.setDepth(4);
        this.player.setDepth(3);

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
        this.canAttack = true;
        this.player.isAttacking = false;


        // Camera settings
        this.cameras.main.roundPixels = true;

        // Input
        this.cursors = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        // Player animations
        this.loadPlayerAnimations(this);

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

        if (Phaser.Input.Keyboard.JustDown(this.attackKey) && !this.beingHit && this.canAttack && !this.player.isAttacking) {
            const dir = this.player.direction || "down";
            this.player.setVelocity(0);
            this.player.isAttacking = true;
            this.canAttack = false;
            this.player.anims.stop();
            this.player.anims.play(`player-attack-${dir}`, true);

            this.player.anims.chain(null);

            this.time.delayedCall(400, () => {
                this.player.isAttacking = false;
                this.canAttack = true;
            });


            return; // prevent movement for this frame
        }




        body.setVelocity(0);
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
                this.player.setVelocity(0);
                this.player.anims.play(`player-idle-${this.player.direction}`, true);
            }
        } else {
            // Optional safety: force player to stay still during attack
            this.player.setVelocity(0);
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

            if (distance < MELEE_RANGE && this.player.isAttacking) { // Adjust range as needed  
                enemy.takeDamage(1); // 👈 call enemy method
            }

            const inAttackRange = distance < ENEMY_MELEE_RANGE;
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
                        this.player.hurtUntil = this.time.now + 500; // 500ms hurt duration
                        this.player.setTint(0xff0000); // Flash red
                        this.player.isAttacking = false;
                        this.canAttack = true;

                        this.time.delayedCall(100, () => {
                            this.player.clearTint();
                        });

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
                    this.beingHit = false;
                });

                // Reset enemy hit tracker after attack cooldown
                this.time.delayedCall(1000, () => {
                    enemy.hasHitPlayer = false;
                });
            }
        });

        // Safety: prevent overlapping flags
        if (this.player.isAttacking && this.player.anims.currentAnim?.key?.includes("attack") === false) {
            this.player.isAttacking = false;
        }
        // Safety net: reset attack flags if animation was interrupted
        if (
            this.player.isAttacking &&
            (!this.player.anims.isPlaying ||
                !this.player.anims.currentAnim?.key.startsWith("player-attack"))
        ) {
            this.player.isAttacking = false;
            this.canAttack = true;
        }

        // Cleanup if attack animation got interrupted
        if (this.player.isAttacking) {
            const current = this.player.anims.currentAnim?.key;
            if (!current || !current.startsWith("player-attack")) {
                this.player.isAttacking = false;
                this.canAttack = true;
                console.log("⛔ Attack interrupted, force reset flags");
            }
        }

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