import Phaser from "phaser";
import { socket } from "./Classes/Socket";

export class LobbyScene extends Phaser.Scene {
    constructor() {
        super("LobbyScene");
    }

    init(data) {
        this.isCreator = data.isCreator || false;
        this.roomCode = null;
        this.players = [];
        this.inputElement = null;
    }

    preload() {
        // Create simple white pixel for effects
        this.load.image('particle', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAFfcULOdwAAAABJRU5ErkJggg==');
    }

    create() {
        // Create professional gradient background
        this.createProfessionalBackground();

        // Add atmospheric particles
        this.createAtmosphericParticles();

        // Main Title with professional styling
        const titleText = this.add.text(this.scale.width / 2, 80, "MULTIPLAYER LOBBY", {
            font: "bold 48px Arial",
            fill: "#3366ff",
            stroke: "#000000",
            strokeThickness: 4
        }).setOrigin(0.5);

        // Add glow effect
        const titleGlow = this.add.text(this.scale.width / 2, 80, "MULTIPLAYER LOBBY", {
            font: "bold 48px Arial",
            fill: "#3366ff",
            alpha: 0.4
        }).setOrigin(0.5);
        titleGlow.setBlendMode(Phaser.BlendModes.ADD);

        // Subtle pulsing animation
        this.tweens.add({
            targets: [titleText, titleGlow],
            scaleX: 1.02,
            scaleY: 1.02,
            duration: 2500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Room Code Display with professional container
        this.createRoomCodeDisplay();

        // Players Display
        this.createPlayersDisplay();

        // Ready Button
        this.createReadyButton();

        // Back Button
        this.createBackButton();

        // If user is creating the room
        if (this.isCreator) {
            socket.emit('createRoom');
        } else {
            this.createJoinRoomInput();
        }

        // Setup all socket events
        this.setupSocketEvents();

        // Add floating network effects
        this.createNetworkEffects();
    }

    createProfessionalBackground() {
        const graphics = this.add.graphics();

        // Create smooth gradient background
        for (let i = 0; i < this.scale.height; i += 2) {
            const progress = i / this.scale.height;
            const r = Math.floor(10 + (30 - 10) * progress);
            const g = Math.floor(15 + (40 - 15) * progress);
            const b = Math.floor(25 + (60 - 25) * progress);

            graphics.fillStyle(Phaser.Display.Color.GetColor(r, g, b));
            graphics.fillRect(0, i, this.scale.width, 2);
        }

        // Add subtle tech grid
        graphics.lineStyle(1, 0x2244aa, 0.15);
        for (let x = 0; x < this.scale.width; x += 40) {
            graphics.moveTo(x, 0);
            graphics.lineTo(x, this.scale.height);
        }
        for (let y = 0; y < this.scale.height; y += 40) {
            graphics.moveTo(0, y);
            graphics.lineTo(this.scale.width, y);
        }
        graphics.strokePath();
    }

    createAtmosphericParticles() {
        const particles = this.add.particles(this.scale.width / 2, this.scale.height / 2, 'particle', {
            x: { min: 0, max: this.scale.width },
            y: { min: 0, max: this.scale.height },
            scale: { min: 0.3, max: 1.2 },
            alpha: { min: 0.1, max: 0.25 },
            tint: [0x3366ff, 0x0066cc, 0x0099ff, 0x6699ff],
            speed: { min: 8, max: 25 },
            lifespan: { min: 5000, max: 9000 },
            frequency: 350,
            blendMode: 'ADD'
        });
        particles.setDepth(-1);
    }

    createRoomCodeDisplay() {
        // Professional container for room code
        const container = this.add.graphics();
        container.fillStyle(0x000000, 0.85);
        container.fillRoundedRect(this.scale.width / 2 - 180, 130, 360, 70, 20);
        container.lineStyle(3, 0x3366ff, 0.8);
        container.strokeRoundedRect(this.scale.width / 2 - 180, 130, 360, 70, 20);

        // Add inner glow effect
        container.lineStyle(1, 0x6699ff, 0.4);
        container.strokeRoundedRect(this.scale.width / 2 - 175, 135, 350, 60, 15);

        this.roomCodeText = this.add.text(this.scale.width / 2, 165, "", {
            font: "bold 28px Arial",
            fill: "#ffaa00",
            stroke: "#000000",
            strokeThickness: 2
        }).setOrigin(0.5);

        // Copy button with professional styling
        this.copyButton = this.createProfessionalButton(
            this.scale.width / 2 + 250, 165, "📋 COPY", "#33aa33", 100, 40,
            () => {
                if (this.roomCode) {
                    navigator.clipboard.writeText(this.roomCode).then(() => {
                        this.showCopyFeedback();
                    }).catch(err => {
                        console.error("Clipboard copy failed", err);
                    });
                    this.showCopyFeedback();
                }
            }
        );
        this.copyButton.setVisible(false);
    }

    createPlayersDisplay() {
        // Players section with professional styling
        const playersContainer = this.add.graphics();
        playersContainer.fillStyle(0x000000, 0.7);
        playersContainer.fillRoundedRect(this.scale.width / 2 - 150, 220, 300, 80, 15);
        playersContainer.lineStyle(2, 0x4477bb, 0.6);
        playersContainer.strokeRoundedRect(this.scale.width / 2 - 150, 220, 300, 80, 15);

        this.add.text(this.scale.width / 2, 240, "PLAYERS", {
            font: "bold 20px Arial",
            fill: "#ffffff",
            stroke: "#000000",
            strokeThickness: 1
        }).setOrigin(0.5);
        let whatTextToShow = "Waiting for players...";
        if (!this.isCreator)
            whatTextToShow = "Waiting to join a room...";
        this.playersText = this.add.text(this.scale.width / 2, 270, whatTextToShow, {
            font: "18px Arial",
            fill: "#cccccc",
            stroke: "#000000",
            strokeThickness: 1
        }).setOrigin(0.5);
    }

    createReadyButton() {
        this.readyButton = this.createProfessionalButton(
            this.scale.width / 2, 350, "I'M READY", "#00aa00", 160, 50,
            () => {
                if (this.roomCode) {
                    socket.emit('playerReady', this.roomCode, "startGame");
                    this.readyButton.buttonText.setText("WAITING...");
                    this.readyButton.disableInteractive();

                    // Change to waiting state visually
                    const bg = this.readyButton.bg;
                    bg.clear();
                    bg.fillStyle(0x666666, 0.9);
                    bg.fillRoundedRect(-80, -25, 160, 50, 25);
                    bg.lineStyle(2, 0x888888, 1);
                    bg.strokeRoundedRect(-80, -25, 160, 50, 25);
                }
            }
        );
        this.readyButton.setVisible(false);

        this.colorInfoText = this.add.text(this.scale.width / 2, this.scale.height - 40,
            'You will appear as the blue player.',
            { font: '18px Arial', fill: '#00bfff' } // Blue text
        ).setOrigin(0.5);

        this.colorInfoText.setStyle({
            backgroundColor: 'rgba(0, 0, 255, 0.1)',
            padding: { x: 10, y: 5 },
            borderRadius: 5
        });

        this.colorInfoText.setAlpha(0);
        this.tweens.add({
            targets: this.colorInfoText,
            alpha: 1,
            duration: 500
        });
    }

    createBackButton() {
        this.backButton = this.createProfessionalButton(
            80, this.scale.height - 40, "← BACK", "#ff3333", 120, 40,
            () => {
                if (this.roomCode) {
                    socket.emit('leaveRoom', this.roomCode);
                }
                this.cleanupInput();
                this.scene.start("StartScene");
            }
        );
    }

    createProfessionalButton(x, y, text, color, width, height, callback) {
        const container = this.add.container(x, y);

        // Button background with professional styling
        const bg = this.add.graphics();
        bg.fillStyle(0x000000, 0.9);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
        bg.lineStyle(2, parseInt(color.replace('#', '0x')), 1);
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, height / 2);

        // Inner highlight
        bg.lineStyle(1, parseInt(color.replace('#', '0x')), 0.3);
        bg.strokeRoundedRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, height / 2 - 2);

        const buttonText = this.add.text(0, 0, text, {
            font: "bold 18px Arial",
            fill: "#ffffff",
            stroke: "#000000",
            strokeThickness: 1
        }).setOrigin(0.5);

        container.add([bg, buttonText]);
        container.setSize(width, height);
        container.setInteractive();

        // Store references
        container.bg = bg;
        container.buttonText = buttonText;
        container.originalColor = color;
        container.width = width;
        container.height = height;

        // Professional hover effects
        container.on("pointerover", () => {
            this.sound.play("button_hover");
            this.tweens.add({
                targets: container,
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 200,
                ease: 'Power2'
            });

            buttonText.setStyle({ fill: color });

            // Glowing hover effect
            bg.clear();
            bg.fillStyle(parseInt(color.replace('#', '0x')), 0.2);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
            bg.lineStyle(3, parseInt(color.replace('#', '0x')), 1);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, height / 2);
            bg.lineStyle(1, parseInt(color.replace('#', '0x')), 0.6);
            bg.strokeRoundedRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, height / 2 - 2);
        });

        container.on("pointerout", () => {
            this.tweens.add({
                targets: container,
                scaleX: 1,
                scaleY: 1,
                duration: 200,
                ease: 'Power2'
            });

            buttonText.setStyle({ fill: "#ffffff" });

            // Reset to normal state
            bg.clear();
            bg.fillStyle(0x000000, 0.9);
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, height / 2);
            bg.lineStyle(2, parseInt(color.replace('#', '0x')), 1);
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, height / 2);
            bg.lineStyle(1, parseInt(color.replace('#', '0x')), 0.3);
            bg.strokeRoundedRect(-width / 2 + 2, -height / 2 + 2, width - 4, height - 4, height / 2 - 2);
        });

        container.on("pointerdown", () => {
            this.sound.play("button_click");
            this.sound.removeByKey("background_music");
            this.tweens.add({
                targets: container,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                yoyo: true,
                onComplete: callback
            });
        });

        return container;
    }

    createJoinRoomInput() {
        // Professional input container
        const inputContainer = this.add.graphics();
        inputContainer.fillStyle(0x000000, 0.9);
        inputContainer.fillRoundedRect(this.scale.width / 2 - 140, 320, 280, 60, 20);
        inputContainer.lineStyle(3, 0x3366ff, 0.8);
        inputContainer.strokeRoundedRect(this.scale.width / 2 - 140, 320, 280, 60, 20);
        inputContainer.lineStyle(1, 0x6699ff, 0.4);
        inputContainer.strokeRoundedRect(this.scale.width / 2 - 135, 325, 270, 50, 15);

        // Get proper canvas positioning
        const canvas = this.sys.game.canvas;
        const canvasRect = canvas.getBoundingClientRect();

        // Create professional input element
        this.inputElement = document.createElement("input");
        this.inputElement.type = "text";
        this.inputElement.placeholder = "Enter Room Code";
        this.inputElement.maxLength = 6;
        this.inputElement.style.position = "fixed";
        const inputTop = canvasRect.top + 450;
        const inputLeft = canvasRect.left + (canvasRect.width / 2) - 125;


        this.inputElement.style.top = `${inputTop}px`;
        this.inputElement.style.left = `${inputLeft}px`;

        this.inputElement.style.width = "250px";
        this.inputElement.style.height = "40px";
        this.inputElement.style.fontSize = "20px";
        this.inputElement.style.fontWeight = "bold";
        this.inputElement.style.textAlign = "center";
        this.inputElement.style.backgroundColor = "rgba(0,0,0,0.8)";
        this.inputElement.style.border = "none";
        this.inputElement.style.color = "#ffffff";
        this.inputElement.style.outline = "none";
        this.inputElement.style.borderRadius = "15px";
        this.inputElement.style.zIndex = "500";
        this.inputElement.id = "roomInput";
        document.body.appendChild(this.inputElement);

        // Professional join button
        this.joinButton = this.createProfessionalButton(
            this.scale.width / 2, 420, "JOIN ROOM", "#3366ff", 160, 50,
            () => {
                const code = this.inputElement.value.trim().toUpperCase();
                if (code && code.length === 4) {
                    this.roomCode = code;
                    socket.emit('joinRoom', code);
                    this.roomCodeText.setText("Room Code: " + code);
                    this.inputElement.style.display = 'none';
                    this.joinButton.setVisible(false);
                    inputContainer.setVisible(false);
                } else {
                    this.showError("Please enter a valid 4-character room code");
                }
            }
        );

        // Input formatting and events
        this.inputElement.focus();
        this.inputElement.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });

        this.inputElement.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.joinButton.emit('pointerdown');
            }
        });

        // Handle window resize
        this.updateInputPosition = () => {
            if (this.inputElement) {
                const canvasRect = this.sys.game.canvas.getBoundingClientRect();
                const inputTop = canvasRect.top + 435;
                const inputLeft = canvasRect.left + (canvasRect.width / 2) - 125;


                this.inputElement.style.top = `${inputTop}px`;
                this.inputElement.style.left = `${inputLeft}px`;
            }
        };

        window.addEventListener('resize', this.updateInputPosition);

        // Cleanup on scene shutdown
        this.events.once('shutdown', () => {
            this.cleanupInput();
        });
    }

    createNetworkEffects() {
        // Professional floating network nodes
        for (let i = 0; i < 8; i++) {
            const node = this.add.circle(
                Phaser.Math.Between(60, this.scale.width - 60),
                Phaser.Math.Between(60, this.scale.height - 60),
                4,
                0x3366ff,
                0.7
            );

            // Pulsing effect
            this.tweens.add({
                targets: node,
                alpha: 0.3,
                scale: 1.3,
                duration: 2500,
                yoyo: true,
                repeat: -1,
                delay: i * 400
            });

            // Floating movement
            this.tweens.add({
                targets: node,
                x: node.x + Phaser.Math.Between(-80, 80),
                y: node.y + Phaser.Math.Between(-80, 80),
                duration: 5000,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut',
                delay: i * 200
            });
        }
    }

    setupSocketEvents() {
        socket.on('roomCreated', ({ roomCode, player }) => {
            this.roomCode = roomCode;
            this.host = player;
            this.roomCodeText.setText(`Room Code: ${roomCode}`);
            this.copyButton.setVisible(true);
        });

        socket.on('playerJoined', (players) => {
            this.players = players;
            this.playersText.setText(`Players in room: ${players.length}/2`);
            if (players.length >= 2) {
                this.readyButton.setVisible(true);
            }
        });

        socket.on('joinError', (msg) => {
            this.showError("Error: " + msg);
            setTimeout(() => {
                this.scene.start("StartScene");
            }, 2000);
        });

        socket.on('startGame', () => {
            this.scene.start("LoadingScene", {
                nextScene: "Arena1_New_Multi",
                roomCode: this.roomCode,
                hostId: this.host
            });
        });

        socket.on('playerLeft', (leftId) => {
            this.players = this.players.filter(p => p !== leftId);
            this.playersText.setText(`Players in room: ${this.players.length}/2`);
            if (this.players.length < 2) {
                this.readyButton.setVisible(false);
                this.readyButton.buttonText.setText("I'M READY");
                this.readyButton.setInteractive();

                // Reset button appearance
                const bg = this.readyButton.bg;
                bg.clear();
                bg.fillStyle(0x000000, 0.9);
                bg.fillRoundedRect(-80, -25, 160, 50, 25);
                bg.lineStyle(2, 0x00aa00, 1);
                bg.strokeRoundedRect(-80, -25, 160, 50, 25);
            }
        });
    }

    showCopyFeedback() {
        const feedback = this.add.text(this.scale.width / 2, 200, "✓ Copied to clipboard!", {
            font: "bold 18px Arial",
            fill: "#33aa33",
            stroke: "#000000",
            strokeThickness: 2
        }).setOrigin(0.5);

        this.tweens.add({
            targets: feedback,
            alpha: 0,
            y: feedback.y - 40,
            duration: 2500,
            ease: 'Power2',
            onComplete: () => feedback.destroy()
        });
    }

    showError(message) {
        const errorBg = this.add.graphics();
        errorBg.fillStyle(0x000000, 0.9);
        errorBg.fillRoundedRect(this.scale.width / 2 - 200, this.scale.height / 2 + 60, 400, 60, 20);
        errorBg.lineStyle(3, 0xff3333, 1);
        errorBg.strokeRoundedRect(this.scale.width / 2 - 200, this.scale.height / 2 + 60, 400, 60, 20);

        const errorText = this.add.text(this.scale.width / 2, this.scale.height / 2 + 90, message, {
            font: "bold 18px Arial",
            fill: "#ff3333",
            stroke: "#000000",
            strokeThickness: 2
        }).setOrigin(0.5);

        this.time.delayedCall(3000, () => {
            if (errorBg && errorBg.scene) errorBg.destroy();
            if (errorText && errorText.scene) errorText.destroy();
        });
    }

    cleanupInput() {
        if (this.inputElement && document.body.contains(this.inputElement)) {
            document.body.removeChild(this.inputElement);
            this.inputElement = null;
        }
        if (this.updateInputPosition) {
            window.removeEventListener('resize', this.updateInputPosition);
            this.updateInputPosition = null;
        }
    }
}