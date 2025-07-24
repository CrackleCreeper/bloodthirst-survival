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
        super.create().then(() => {

            this.setupMultiplayer();

            console.log("Multiplayer registered animations:", this.anims.anims.keys());
        });


    }

    setupMultiplayer() {
        console.log("Multiplayer setup initialized");

        this.players = this.physics.add.group();
        this.frontendPlayers = {};

        socket.on("connect_error", (err) => {
            console.error("Socket connection error:", err);
        });

        socket.on("updatePlayers", (players) => {
            Object.values(players).forEach(playerInfo => {
                if (!this.frontendPlayers[playerInfo.id]) {
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
                    this.physics.add.collider(newPlayer, this.layers.collisions);


                    this.frontendPlayers[playerInfo.id] = newPlayer;
                } else {
                    const sprite = this.frontendPlayers[playerInfo.id];
                    sprite.setPosition(playerInfo.x, playerInfo.y);
                    // Handle animation
                    if (!sprite.anims.isPlaying || sprite.direction !== playerInfo.direction) {
                        sprite.anims.play(`player-run-${playerInfo.direction}`, true);
                        sprite.direction = playerInfo.direction;
                    }
                }
            });

            Object.keys(this.frontendPlayers).forEach(id => {
                if (!players[id]) {
                    this.frontendPlayers[id].destroy();
                    delete this.frontendPlayers[id];
                }
            });
        });

        socket.on("playerAttack", ({ playerId, direction }) => {
            const player = this.frontendPlayers[playerId];
            if (player) {
                player.anims.play(`player-attack-${direction}`, true);
                player.isAttacking = true;

                this.time.delayedCall(400, () => {
                    if (player) player.isAttacking = false;
                });
            }
        });


        socket.on("playerMoved", (data) => {
            const otherPlayer = this.frontendPlayers[data.playerId];
            if (otherPlayer && data.playerId !== socket.id) {
                otherPlayer.setPosition(data.x, data.y);
                if (data.isMoving) {
                    otherPlayer.anims.play(`player-run-${data.direction}`, true);
                } else {
                    otherPlayer.anims.play(`player-idle-${data.direction}`, true);
                }
            }
        });



        socket.on("connect", () => {
            console.log("Connected to server with ID:", socket.id);
            socket.emit("readyForPlayers");
        });

        if (socket.connected) {
            socket.emit("readyForPlayers");
        }

        // Movement input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.W = this.input.keyboard.addKey('W');
        this.A = this.input.keyboard.addKey('A');
        this.S = this.input.keyboard.addKey('S');
        this.D = this.input.keyboard.addKey('D');
    }

    update(time, delta) {
        // super.update(time, delta);

        if (!this.frontendPlayers || !socket.id || !this.frontendPlayers[socket.id] || !this.areAnimationsLoaded) return;

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
            let vx = 0, vy = 0;
            let direction = "down";

            if (this.W.isDown) {
                vy = -speed;
                direction = "up";
            } else if (this.S.isDown) {
                vy = speed;
                direction = "down";
            }

            if (this.A.isDown) {
                vx = -speed;
                direction = "left";
            } else if (this.D.isDown) {
                vx = speed;
                direction = "right";
            }

            myPlayer.setVelocity(vx, vy);

            if (vx !== 0 || vy !== 0) {
                if (!myPlayer.anims.isPlaying || myPlayer.direction !== direction) {
                    myPlayer.anims.play(`player-run-${direction}`, true);
                    myPlayer.direction = direction;
                }
            } else {
                if (!myPlayer.anims.isPlaying || !myPlayer.anims.currentAnim.key.includes("idle")) {
                    myPlayer.anims.play(`player-idle-${myPlayer.direction}`, true);
                }
            }


            if (socket && this.frontendPlayers[socket.id]) {
                const myPlayer = this.frontendPlayers[socket.id];
                const { x, y } = myPlayer;
                const isMoving = (vx !== 0 || vy !== 0);
                const direction = myPlayer.direction;

                if (x !== this.lastSentX || y !== this.lastSentY || isMoving !== this.lastMoving || direction !== this.lastDirection) {
                    socket.emit("playerMoved", {
                        playerId: socket.id,
                        x, y, isMoving, direction
                    });
                    this.lastSentX = x;
                    this.lastSentY = y;
                    this.lastMoving = isMoving;
                    this.lastDirection = direction;
                }
            }
        }


    }
}
