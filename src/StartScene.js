import Phaser from "phaser";

export default class StartScene extends Phaser.Scene {
    constructor() {
        super("StartScene");
    }

    preload() {
        // Load any assets like background or button sprites if needed
    }

    create() {
        // Background color or image
        this.cameras.main.setBackgroundColor("#1a1a1a");

        // Game Title
        this.add.text(this.scale.width / 2, this.scale.height / 3, "Bloodthirst Survival", {
            font: "48px Arial",
            fill: "#ff0033"
        }).setOrigin(0.5);

        // Start Button
        const startText = this.add.text(this.scale.width / 2, this.scale.height / 2, "Start Game", {
            font: "32px Arial",
            fill: "#ffffff"
        }).setOrigin(0.5).setInteractive();

        startText.on("pointerover", () => startText.setStyle({ fill: "#ff3333" }));
        startText.on("pointerout", () => startText.setStyle({ fill: "#ffffff" }));
        startText.on("pointerdown", () => {
            this.scene.start("GameScene"); // replace with your main game scene name
        });

        // Optional: Credits / Controls
        this.add.text(this.scale.width / 2, this.scale.height * 0.75, "Use WASD to move, Mouse to attack", {
            font: "16px Arial",
            fill: "#aaaaaa"
        }).setOrigin(0.5);
    }
}
