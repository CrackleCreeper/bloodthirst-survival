// Import Phaser and EasyStar
import Phaser from "phaser";
import EasyStar from "easystarjs";
import Enemy from "./Classes/Enemy";


export class SceneMain extends Phaser.Scene {
    constructor() {
        super("SceneMain");
    }

    preload() {
        // Load tileset images
        this.load.image("tileset", "assets/tileset_arranged.png"); // tileset_arranged
        this.load.image("objects", "assets/obstacles-and-objects.png");
        this.load.spritesheet("main", 'assets/Sprite/Knight_10.png', { frameWidth: 32, frameHeight: 32 });
        this.load.image("enemy", "assets/Sprite/temporary_enemy.png");


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
        this.cameras.main.startFollow(this.player);
        background.setDepth(0);
        collisions.setDepth(1);
        overhead.setDepth(3);
        this.player.setDepth(2);

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
            const enemy = new Enemy(this, spawnObj.x, spawnObj.y, "enemy", {
                hp: 3,
                speed: 50,
                type: 'basic'
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
            frames: this.anims.generateFrameNumbers("main", { start: 0, end: 4 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: "walk-up",
            frames: this.anims.generateFrameNumbers("main", { start: 48, end: 52 }),
            frameRate: 10,
            repeat: -1
        });

        this.anims.create({
            key: "walk-left",
            frames: this.anims.generateFrameNumbers("main", { start: 16, end: 20 }),
            frameRate: 10,
            repeat: -1
        });
        this.anims.create({
            key: "walk-right",
            frames: this.anims.generateFrameNumbers("main", { start: 32, end: 36 }),
            frameRate: 10,
            repeat: -1
        });


        // Check if player is hit
        this.physics.add.collider(this.player, this.enemies, (player, enemy) => {
            if (!player.invulnerable) {
                player.hp--;
                console.log("Player hit! HP:", player.hp);

                player.invulnerable = true;
                player.setTint(0xff0000);

                // Reset after short delay
                this.time.delayedCall(1000, () => {
                    player.invulnerable = false;
                    player.clearTint();
                });

                if (player.hp <= 0) {
                    console.log("💀 Game Over");
                    player.setVelocity(0, 0);
                    player.setTint(0x000000);
                    player.disableBody(true, true);
                }
            }
        });
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
            this.player.anims.play("walk-left", true);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(speed);
            this.player.anims.play("walk-right", true);
        } else if (this.cursors.up.isDown) {
            this.player.setVelocityY(-speed);
            this.player.anims.play("walk-up", true);
        } else if (this.cursors.down.isDown) {
            this.player.setVelocityY(speed);
            this.player.anims.play("walk-down", true);
        } else {
            this.player.anims.stop();
        }

        // DEBUG 
        // this.debugGraphics.clear();

        // this.enemies.children.iterate((enemy) => {
        //     if (!enemy.active) return;
        //     const now = this.time.now;
        //     enemy.drawDebugLines(now, this.debugGraphics, this.player);
        // });

        // Handle enemy wandering and chasing
        this.enemies.children.iterate((enemy) => {
            if (!enemy.active) return;
            enemy.update(this.time.now, this.player);
        });
    }
}