// GameOverScene.js

import { socket } from "./Classes/Socket";

export default class GameOverScene extends Phaser.Scene {
    constructor() {
        super("GameOverScene");
    }

    init(data) {
        this.win = data.win;
        this.roomCode = data.roomCode;
        this.hostId = data.hostId;
    }

    create() {
        const centerX = this.scale.width / 2;
        const centerY = this.scale.height / 2;

        // Win/Lose text
        this.add.text(centerX, centerY - 100, this.win ? "You Win!" : "You Lose", {
            fontSize: "48px",
            color: "#fff"
        }).setOrigin(0.5);

        // Restart button
        const restartBtn = this.add.text(centerX, centerY, "Restart Game", {
            fontSize: "32px",
            color: "#0f0",
            backgroundColor: "#222",
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive();

        // Main Menu button
        const mainMenuBtn = this.add.text(centerX, centerY + 80, "Main Menu", {
            fontSize: "32px",
            color: "#f00",
            backgroundColor: "#222",
            padding: { x: 10, y: 5 }
        }).setOrigin(0.5).setInteractive();

        // Restart button click
        restartBtn.on("pointerdown", () => {
            socket.emit("playerReady", this.roomCode, "restart");
            restartBtn.setText("Waiting for other player...");
            restartBtn.disableInteractive();
        });

        // Main menu click
        mainMenuBtn.on("pointerdown", () => {
            socket.emit("leaveGame");
            this.scene.stop();
            this.scene.start("StartScene");
        });

        // Listen for restart signal from server
        socket.removeAllListeners("restartGame").on("restartGame", () => {
            this.scene.stop();
            this.scene.start("Arena1_New_Multi", {
                hostId: this.hostId,
                roomCode: this.roomCode,
            }); // change to your game scene name
        });
    }
}
