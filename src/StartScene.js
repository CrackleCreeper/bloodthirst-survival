import Phaser from "phaser";
import { setMultiplayerMode } from './Classes/Socket.js';


export class StartScene extends Phaser.Scene {
    constructor() {
        super("StartScene");
    }

    preload() {
        this.load.image('particle', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAADZHrRKAAAAD0lEQVR42mP8z8DwHwAEjQKAC19azgAAAABJRU5ErkJggg==');

        // Load audio
        this.load.audio('background_music', 'assets/Audio/Menu_Background.mp3');
        this.load.audio('button_click', 'assets/Audio/Button_Click.mp3');
        this.load.audio('button_hover', 'assets/Audio/Button_Hover.mp3');
    }

    create() {
        this.game.events.off('hidden', this.game.loop.sleep, this.game.loop);
        this.game.events.off('visible', this.game.loop.wake, this.game.loop);
        this.sound.stopAll();
        this.sound.play('background_music', { loop: true, volume: 0.5 });
        this.cameras.main.fadeIn(1000, 0, 0, 0);
        this.createGradientBackground();
        this.createParticleSystem();

        const titleY = this.scale.height / 4;
        const subtitleY = titleY + 80;
        const buttonsStartY = subtitleY + 80;

        // Title
        const titleText = this.add.text(this.scale.width / 2, titleY, "BLOODTHIRST", {
            font: "bold 72px Arial",
            fill: "#ff0033",
            stroke: "#000000",
            strokeThickness: 4
        }).setOrigin(0.5);

        const titleGlow = this.add.text(this.scale.width / 2, titleY, "BLOODTHIRST", {
            font: "bold 72px Arial",
            fill: "#ff0033",
            alpha: 0.3
        }).setOrigin(0.5).setBlendMode(Phaser.BlendModes.ADD);

        // Subtitle
        this.add.text(this.scale.width / 2, subtitleY, "SURVIVAL", {
            font: "36px Arial",
            fill: "#ffffff",
            stroke: "#000000",
            strokeThickness: 2
        }).setOrigin(0.5);

        // Title pulse animation
        this.tweens.add({
            targets: [titleText, titleGlow],
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 2000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Buttons
        this.createStyledButton(this.scale.width / 2, buttonsStartY, "SINGLEPLAYER", "#ff3333", "Arena1_New", false);
        this.createStyledButton(this.scale.width / 2, buttonsStartY + 80, "CREATE A ROOM", "#3366ff", "LobbyScene", true);

        this.createStyledButton(this.scale.width / 2, buttonsStartY + 160, "JOIN A ROOM", "#ffaa00", "LobbyScene", true, false);


        this.createFloatingEmbers();

        this.add.text(this.scale.width / 2, this.scale.height - 30, "WASD TO MOVE  •  SPACE TO ATTACK", {
            font: "18px Arial",
            fill: "#cccccc",
            stroke: "#000000",
            strokeThickness: 1
        }).setOrigin(0.5);


        this.add.text(this.scale.width - 10, this.scale.height - 10, "v0.1 © 2025 Designed & Developed by Rihan", {
            font: "12px Arial",
            fill: "#888888",
            stroke: "#000000",
            strokeThickness: 1
        }).setOrigin(1);

        this.time.delayedCall(1000, () => {
            this.cameras.main.shake(100, 0.002);
        });
    }

    createGradientBackground() {
        const graphics = this.add.graphics();
        for (let i = 0; i < this.scale.height; i += 4) {
            const progress = i / this.scale.height;
            const r = Math.floor(26 + (51 - 26) * progress);
            const g = Math.floor(26 + (17 - 26) * progress);
            const b = Math.floor(26 + (17 - 26) * progress);
            graphics.fillStyle(Phaser.Display.Color.GetColor(r, g, b));
            graphics.fillRect(0, i, this.scale.width, 4);
        }
    }

    createParticleSystem() {
        const particles = this.add.particles(this.scale.width / 2, this.scale.height / 2, 'particle', {
            x: { min: 0, max: this.scale.width },
            y: { min: 0, max: this.scale.height },
            scale: { min: 0.5, max: 2 },
            alpha: { min: 0.1, max: 0.3 },
            tint: [0xff0033, 0x990022, 0x660011],
            speed: { min: 5, max: 20 },
            lifespan: { min: 4000, max: 8000 },
            frequency: 300,
            blendMode: 'ADD'
        });
        particles.setDepth(-1);
    }

    createStyledButton(x, y, text, color, targetScene, isMultiplayer = false, isCreator = true) {
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.7);
        bg.fillRoundedRect(-120, -25, 240, 50, 25);
        bg.lineStyle(2, parseInt(color.replace('#', '0x')), 1);
        bg.strokeRoundedRect(-120, -25, 240, 50, 25);

        const buttonText = this.add.text(0, 0, text, {
            font: "bold 24px Arial",
            fill: "#ffffff",
            stroke: "#000000",
            strokeThickness: 1
        }).setOrigin(0.5);

        const button = this.add.container(x, y, [bg, buttonText]);

        // Correct hitbox
        const zone = this.add.zone(0, 0, 240, 50).setInteractive();
        button.add(zone);
        // this.input.enableDebug(zone); // Optional: visual debug

        zone.on('pointerover', () => {
            this.tweens.add({ targets: button, scaleX: 1.1, scaleY: 1.1, duration: 200 });
            this.sound.play('button_hover');
            buttonText.setStyle({ fill: color });
            bg.clear();
            bg.fillStyle(parseInt(color.replace('#', '0x')), 0.2);
            bg.fillRoundedRect(-120, -25, 240, 50, 25);
            bg.lineStyle(3, parseInt(color.replace('#', '0x')), 1);
            bg.strokeRoundedRect(-120, -25, 240, 50, 25);
        });

        zone.on('pointerout', () => {
            this.tweens.add({ targets: button, scaleX: 1, scaleY: 1, duration: 200 });
            buttonText.setStyle({ fill: '#ffffff' });
            bg.clear();
            bg.fillStyle(0x000000, 0.7);
            bg.fillRoundedRect(-120, -25, 240, 50, 25);
            bg.lineStyle(2, parseInt(color.replace('#', '0x')), 1);
            bg.strokeRoundedRect(-120, -25, 240, 50, 25);
        });

        zone.on('pointerdown', () => {
            this.tweens.add({
                targets: button,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                yoyo: true,
                onComplete: () => {
                    this.sound.play('button_click');
                    this.time.delayedCall(600, () => {
                        if (isMultiplayer) {
                            setMultiplayerMode(true);
                            this.scene.start("LobbyScene", { isCreator });
                        } else {
                            setMultiplayerMode(false);
                            this.sound.stopAll();
                            this.cameras.main.fadeOut(500, 0, 0, 0);
                            this.time.delayedCall(500, () => this.scene.start("LoadingScene", { nextScene: targetScene }));
                        }

                    });
                }
            });
        });



    }

    createFloatingEmbers() {
        for (let i = 0; i < 8; i++) {
            const ember = this.add.circle(
                Phaser.Math.Between(0, this.scale.width),
                Phaser.Math.Between(this.scale.height, this.scale.height + 100),
                Phaser.Math.Between(1, 3),
                0xff6600, 0.6
            );
            this.tweens.add({
                targets: ember,
                y: -50,
                x: ember.x + Phaser.Math.Between(-50, 50),
                alpha: 0,
                duration: Phaser.Math.Between(4000, 8000),
                delay: Phaser.Math.Between(0, 3000),
                repeat: -1,
                onRepeat: () => {
                    ember.setPosition(Phaser.Math.Between(0, this.scale.width), this.scale.height + Phaser.Math.Between(0, 50));
                    ember.setAlpha(0.6);
                }
            });
        }
    }
}
