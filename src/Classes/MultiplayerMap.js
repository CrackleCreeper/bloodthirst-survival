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
            console.log("Received players update:", players);

            Object.values(players).forEach(playerInfo => {
                if (!this.frontendPlayers[playerInfo.id]) {
                    this.frontendPlayers[playerInfo.id] = this.physics.add.sprite(playerInfo.x, playerInfo.y, 'main_idle_down').setScale(1);
                    this.frontendPlayers[playerInfo.id].playerId = playerInfo.id;
                    this.frontendPlayers[playerInfo.id].direction = "down";
                    this.frontendPlayers[playerInfo.id].setCollideWorldBounds(true);
                    this.frontendPlayers[playerInfo.id].speed = 250;
                    this.frontendPlayers[playerInfo.id].baseSpeed = 250;
                    this.frontendPlayers[playerInfo.id].setSize(20, 34);
                    this.frontendPlayers[playerInfo.id].setOffset(this.frontendPlayers[playerInfo.id].width / 2 - 10, this.frontendPlayers[playerInfo.id].height / 2 - 15);
                    this.frontendPlayers[playerInfo.id].setDepth(3);
                    this.frontendPlayers[playerInfo.id].isDead = false;
                    this.frontendPlayers[playerInfo.id].attackMultiplier = 1;
                    this.frontendPlayers[playerInfo.id].frozen = false;
                    this.frontendPlayers[playerInfo.id].flippedControls = false;
                }
            });

            Object.keys(this.frontendPlayers).forEach(id => {
                if (!players[id]) {
                    this.frontendPlayers[id].destroy();
                    delete this.frontendPlayers[id];
                }
            });
        });

        // Attach connect listener
        socket.on("connect", () => {
            console.log("Connected to server with ID:", socket.id);
            socket.emit("readyForPlayers");
        });

        // Handle case if already connected before this ran
        if (socket.connected) {
            console.log("Already connected, emitting readyForPlayers");
            socket.emit("readyForPlayers");
        }
    }


    update() {
        super.update();

    }

}
