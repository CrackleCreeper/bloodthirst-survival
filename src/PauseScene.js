import Phaser from "phaser";

export class PauseScene extends Phaser.Scene {
    constructor() {
        super("PauseScene");
    }

    preload() {
        // Create a simple white pixel for particles and effects
        this.load.image('particle', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAFfcULOdwAAAABJRU5ErkJggg==');
    }

    create(data) {
        this.parentSceneKey = data.parent;
        // Create semi-transparent dark overlay
        this.createOverlay();

        // Add subtle floating particles
        this.createParticleSystem();

        // Enhanced Pause Title
        const pauseText = this.add.text(this.scale.width / 2, this.scale.height / 4, "GAME PAUSED", {
            font: "bold 56px Arial",
            fill: "#ffaa00",
            stroke: "#000000",
            strokeThickness: 4
        }).setOrigin(0.5);

        // Add glow effect to title
        const pauseGlow = this.add.text(this.scale.width / 2, this.scale.height / 4, "GAME PAUSED", {
            font: "bold 56px Arial",
            fill: "#ffaa00",
            alpha: 0.3
        }).setOrigin(0.5);
        pauseGlow.setBlendMode(Phaser.BlendModes.ADD);

        // Pulsing animation for title
        this.tweens.add({
            targets: [pauseText, pauseGlow],
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Resume Button
        const resumeButton = this.createStyledButton(
            this.scale.width / 2,
            this.scale.height / 2 - 40,
            "RESUME",
            "#33ff33",
            () => this.resumeGame()
        );

        // Settings Button
        const settingsButton = this.createStyledButton(
            this.scale.width / 2,
            this.scale.height / 2 + 20,
            "SETTINGS",
            "#3366ff",
            () => this.scene.start("SettingsScene")
        );

        // Main Menu Button
        const mainMenuButton = this.createStyledButton(
            this.scale.width / 2,
            this.scale.height / 2 + 80,
            "MAIN MENU",
            "#ff3333",
            () => this.goToMainMenu()
        );

        // Quit Game Button
        const quitButton = this.createStyledButton(
            this.scale.width / 2,
            this.scale.height / 2 + 140,
            "QUIT GAME",
            "#ff6666",
            () => this.quitGame()
        );

        // Add floating particles for atmosphere
        this.createFloatingParticles();

        // Controls reminder
        this.add.text(this.scale.width / 2, this.scale.height * 0.85, "Press ESC to Resume", {
            font: "18px Arial",
            fill: "#cccccc",
            stroke: "#000000",
            strokeThickness: 1
        }).setOrigin(0.5);

        // Add ESC key listener
        this.input.keyboard.on('keydown-ESC', () => {
            this.resumeGame();
        });

        // Add subtle screen pulse
        this.cameras.main.setAlpha(0.95);
        this.tweens.add({
            targets: this.cameras.main,
            alpha: 1,
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    createOverlay() {
        // Create dark semi-transparent background
        const overlay = this.add.graphics();
        overlay.fillStyle(0x000000, 0.8);
        overlay.fillRect(0, 0, this.scale.width, this.scale.height);

        // Add subtle gradient effect
        for (let i = 0; i < this.scale.height; i += 8) {
            const progress = i / this.scale.height;
            const alpha = 0.1 + (0.2 * Math.sin(progress * Math.PI));
            overlay.fillStyle(0x330011, alpha);
            overlay.fillRect(0, i, this.scale.width, 8);
        }
    }

    createParticleSystem() {
        // Subtle floating particles
        const particles = this.add.particles(this.scale.width / 2, this.scale.height / 2, 'particle', {
            x: { min: 0, max: this.scale.width },
            y: { min: 0, max: this.scale.height },
            scale: { min: 0.3, max: 1 },
            alpha: { min: 0.05, max: 0.15 },
            tint: [0xffaa00, 0xff6600, 0xff3300],
            speed: { min: 2, max: 10 },
            lifespan: { min: 6000, max: 10000 },
            frequency: 500,
            blendMode: 'ADD'
        });

        particles.setDepth(-1);
    }

    createStyledButton(x, y, text, color, callback) {
        const width = 200;
        const height = 44;

        // Background
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.8);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 22);
        bg.lineStyle(2, parseInt(color.replace('#', '0x')), 1);
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 22);

        // Text
        const buttonText = this.add.text(0, 0, text, {
            font: "bold 20px Arial",
            fill: "#ffffff",
            stroke: "#000000",
            strokeThickness: 1
        }).setOrigin(0.5);

        // Zone for click detection
        const zone = this.add.zone(0, 0, width, height).setInteractive();

        const button = this.add.container(x, y, [bg, buttonText, zone]);

        // Hover effects
        zone.on("pointerover", () => {
            this.tweens.add({ targets: button, scaleX: 1.1, scaleY: 1.1, duration: 150 });
            buttonText.setStyle({ fill: color });
            bg.clear();
            bg.fillStyle(parseInt(color.replace('#', '0x')), 0.3);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, 22);
            bg.lineStyle(3, parseInt(color.replace('#', '0x')), 1);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 22);
        });

        zone.on("pointerout", () => {
            this.tweens.add({ targets: button, scaleX: 1, scaleY: 1, duration: 150 });
            buttonText.setStyle({ fill: "#ffffff" });
            bg.clear();
            bg.fillStyle(0x000000, 0.8);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, 22);
            bg.lineStyle(2, parseInt(color.replace('#', '0x')), 1);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 22);
        });

        zone.on("pointerdown", () => {
            this.tweens.add({
                targets: button,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                yoyo: true,
                onComplete: () => callback()
            });
        });

        return button;
    }


    createFloatingParticles() {
        // Add floating light particles for atmosphere
        for (let i = 0; i < 6; i++) {
            const particle = this.add.circle(
                Phaser.Math.Between(0, this.scale.width),
                Phaser.Math.Between(0, this.scale.height),
                Phaser.Math.Between(1, 2),
                0xffaa00,
                0.4
            );

            this.tweens.add({
                targets: particle,
                y: particle.y - Phaser.Math.Between(50, 150),
                x: particle.x + Phaser.Math.Between(-30, 30),
                alpha: 0,
                duration: Phaser.Math.Between(3000, 6000),
                delay: Phaser.Math.Between(0, 2000),
                repeat: -1,
                onRepeat: () => {
                    particle.setPosition(
                        Phaser.Math.Between(0, this.scale.width),
                        Phaser.Math.Between(this.scale.height, this.scale.height + 50)
                    );
                    particle.setAlpha(0.4);
                }
            });
        }
    }

    resumeGame() {
        this.scene.resume(this.parentSceneKey); // resume game
        this.scene.stop(); // close pause scene
    }

    goToMainMenu() {
        this.cameras.main.fadeOut(500, 0, 0, 0);

        this.cameras.main.once('camerafadeoutcomplete', () => {
            this.scene.stop(this.parentSceneKey); // stop the parent scene
            this.scene.stop('PauseScene'); // stop pause scene

            // Make sure StartScene is active and on top
            if (this.scene.isSleeping('StartScene')) this.scene.wake('StartScene');
            if (!this.scene.isActive('StartScene')) this.scene.start('StartScene');
            else this.scene.bringToTop('StartScene');
        });
    }







    quitGame() {
        // Show confirmation or quit the game
        // For web games, you might want to show a confirmation dialog
        if (confirm("Are you sure you want to quit the game?")) {
            // Close the game or redirect to a different page
            window.close();
        }
    }
}