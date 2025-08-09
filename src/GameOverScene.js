// GameOverScene.js
import Phaser from "phaser"
import { socket } from "./Classes/Socket"

export default class GameOverScene extends Phaser.Scene {
    constructor() {
        super("GameOverScene")
    }

    init(data) {
        this.win = data.win;
        this.loserId = data.loserId;
        this.roomCode = data.roomCode
        this.hostId = data.hostId
        this._restartHandler = null
    }

    preload() {
        // 1x1 white pixel for particles and effects
        this.load.image(
            "particle",
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
        )
    }

    create() {
        console.log("Create getting called")
        const { width: w, height: h } = this.scale
        const cx = w / 2
        const cy = h / 2

        // Subtle fade-in (visual only)
        this.cameras.main.fadeIn(400, 0, 0, 0)

        // Cinematic background
        // this.drawGradientBackground()
        // this.addVignette()
        // this.addScanlines()       // new: subtle scanlines
        // this.addAtmosphere()

        // Title
        if (!this.titleText)
            this.titleText = this.add
                .text(cx, cy - 120, this.win ? "VICTORY" : "DEFEAT", {
                    font: "bold 72px Arial",
                    fill: this.win ? "#33ff66" : "#ff3344",
                    stroke: "#000000",
                    strokeThickness: 6,
                })
                .setOrigin(0.5)
        this.titleGlow = this.add
            .text(cx, cy - 120, this.win ? "VICTORY" : "DEFEAT", {
                font: "bold 72px Arial",
                fill: this.win ? "#33ff66" : "#ff3344",
                alpha: 0.35,
            })
            .setOrigin(0.5)
        this.titleGlow.setBlendMode(Phaser.BlendModes.ADD)
        this.tweens.add({
            targets: [this.titleText, this.titleGlow],
            scaleX: 1.04,
            scaleY: 1.04,
            duration: 1800,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut",
        })




        // new: pulsing ring behind title (purely visual)
        this.addPulseRing(cx, cy - 120, this.win ? 0x33ff66 : 0xff3344)

        // Subtitle
        this.subtitle = this.add
            .text(
                cx,
                cy - 70,
                this.win ? "Blood well spent." : "The arena claims another.",
                {
                    font: "24px Arial",
                    fill: "#dddddd",
                    stroke: "#000000",
                    strokeThickness: 2,
                }
            )
            .setOrigin(0.5)

        // Buttons (unchanged logic)
        this.restartButton = this.createButton(
            cx,
            cy + 10,
            "RESTART MATCH",
            "#33aa33",
            () => this.requestRestart()
        )

        this.menuButton = this.createButton(cx, cy + 80, "MAIN MENU", "#ff3333", () =>
            this.goToMenu()
        )

        // Tip text
        this.add
            .text(
                cx,
                h - 60,
                "R = Restart • M = Main Menu",
                {
                    font: "18px Arial",
                    fill: "#cccccc",
                    stroke: "#000000",
                    strokeThickness: 1,
                }
            )
            .setOrigin(0.5)

        // Keyboard shortcuts (unchanged)
        this.input.keyboard.on("keydown-R", () => this.requestRestart())
        this.input.keyboard.on("keydown-M", () => this.goToMenu())

        // Socket listener (unchanged)
        socket.removeAllListeners("restartGame").on("restartGame", () => {
            this.scene.stop();
            this.scene.start("Arena1_New_Multi", {
                hostId: this.hostId,
                roomCode: this.roomCode,
            }); // change to your game scene name
        });

        // Result particles (unchanged)
        this.spawnResultParticles()
    }

    // ------------- UI Helpers -------------
    createButton(x, y, label, color, onClick) {
        const width = 220
        const height = 50
        const container = this.add.container(x, y)

        const bg = this.add.graphics()
        bg.fillStyle(0x000000, 0.9)
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, 24)
        bg.lineStyle(2, parseInt(color.replace("#", "0x")), 1)
        bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 24)
        // inner highlight
        bg.lineStyle(1, parseInt(color.replace("#", "0x")), 0.35)
        bg.strokeRoundedRect(
            -width / 2 + 2,
            -height / 2 + 2,
            width - 4,
            height - 4,
            22
        )

        const text = this.add
            .text(0, 0, label, {
                font: "bold 20px Arial",
                fill: "#ffffff",
                stroke: "#000000",
                strokeThickness: 2,
            })
            .setOrigin(0.5)

        container.add([bg, text])
        container.setSize(width, height)
        const hitArea = new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height);
        container.setInteractive({
            hitArea: hitArea,
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            useHandCursor: true
        });

        // store refs for state changes
        container.bg = bg
        container.buttonText = text
        container.buttonColor = color
        container.buttonWidth = width
        container.buttonHeight = height


        // const dbg = this.add.graphics();
        // dbg.lineStyle(2, 0x00ff00, 0.9);
        // dbg.strokeRect(-width / 2, -height / 2, width, height);
        // dbg.setDepth(9999);
        // container.add(dbg);
        // container.debugHit = dbg;

        // hover
        container.on("pointerover", () => {
            this.sound.play("button_hover");
            this.tweens.add({
                targets: container,
                scaleX: 1.05,
                scaleY: 1.05,
                duration: 150,
                ease: "Power2",
            })
            text.setStyle({ fill: color })

            bg.clear()
            bg.fillStyle(parseInt(color.replace("#", "0x")), 0.2)
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, 24)
            bg.lineStyle(3, parseInt(color.replace("#", "0x")), 1)
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 24)
            bg.lineStyle(1, parseInt(color.replace("#", "0x")), 0.6)
            bg.strokeRoundedRect(
                -width / 2 + 2,
                -height / 2 + 2,
                width - 4,
                height - 4,
                22
            )
        })

        container.on("pointerout", () => {
            this.tweens.add({
                targets: container,
                scaleX: 1,
                scaleY: 1,
                duration: 150,
                ease: "Power2",
            })
            text.setStyle({ fill: "#ffffff" })

            bg.clear()
            bg.fillStyle(0x000000, 0.9)
            bg.fillRoundedRect(-width / 2, -height / 2, width, height, 24)
            bg.lineStyle(2, parseInt(color.replace("#", "0x")), 1)
            bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 24)
            bg.lineStyle(1, parseInt(color.replace("#", "0x")), 0.35)
            bg.strokeRoundedRect(
                -width / 2 + 2,
                -height / 2 + 2,
                width - 4,
                height - 4,
                22
            )
        })

        container.on("pointerdown", () => {
            this.sound.play("button_click");
            this.tweens.add({
                targets: container,
                scaleX: 0.96,
                scaleY: 0.96,
                duration: 90,
                yoyo: true,
                ease: "Power2",
                onComplete: () => onClick && onClick(),
            })
        })

        return container
    }

    drawGradientBackground() {
        const { width: w, height: h } = this.scale
        const g = this.add.graphics()
        for (let i = 0; i < h; i += 2) {
            const t = i / h
            // deeper red if lose, bluish-green if win
            const start = this.win ? { r: 12, g: 28, b: 24 } : { r: 30, g: 10, b: 12 }
            const end = this.win ? { r: 20, g: 48, b: 40 } : { r: 60, g: 20, b: 24 }
            const r = Math.floor(start.r + (end.r - start.r) * t)
            const gC = Math.floor(start.g + (end.g - start.g) * t)
            const b = Math.floor(start.b + (end.b - start.b) * t)
            g.fillStyle(Phaser.Display.Color.GetColor(r, gC, b))
            g.fillRect(0, i, w, 2)
        }

        // subtle grid
        g.lineStyle(1, 0x222222, 0.15)
        for (let x = 0; x < w; x += 50) {
            g.moveTo(x, 0)
            g.lineTo(x, h)
        }
        for (let y = 0; y < h; y += 50) {
            g.moveTo(0, y)
            g.lineTo(w, y)
        }
        g.strokePath()
    }

    addVignette() {
        const { width: w, height: h } = this.scale
        const v = this.add.graphics()
        const steps = 60
        for (let i = 0; i < steps; i++) {
            const alpha = (i / steps) * 0.55
            const radius = ((w + h) / 2) * (1 - i / steps)
            v.fillStyle(0x000000, alpha)
            v.fillCircle(w / 2, h / 2, radius)
        }
        v.setDepth(10)
    }

    // new: scanline overlay (subtle)
    addScanlines() {
        const { width: w, height: h } = this.scale
        const g = this.add.graphics()
        g.lineStyle(1, 0x000000, 0.12)
        for (let y = 0; y < h; y += 3) {
            g.moveTo(0, y)
            g.lineTo(w, y)
        }
        g.strokePath()
        g.setDepth(9)
    }

    addAtmosphere() {
        const { width: w, height: h } = this.scale
        const tints = this.win
            ? [0x33ff66, 0x66ffaa, 0x99ffcc]
            : [0xff3344, 0xaa2233, 0x661122]

        // drifting particles
        this.add.particles(w / 2, h / 2, "particle", {
            x: { min: 0, max: w },
            y: { min: 0, max: h },
            scale: { min: 0.3, max: 1.2 },
            alpha: { min: 0.08, max: 0.25 },
            tint: tints,
            speed: { min: 6, max: 18 },
            lifespan: { min: 4000, max: 9000 },
            frequency: 280,
            blendMode: "ADD",
        }).setDepth(-1)
    }

    // new: pulsing ring behind title
    addPulseRing(x, y, color) {
        const ring = this.add.circle(x, y, 110, 0x000000, 0)
        ring.setStrokeStyle(2, color, 0.7)
        ring.setBlendMode(Phaser.BlendModes.ADD)
        this.tweens.add({
            targets: ring,
            scaleX: 1.25,
            scaleY: 1.25,
            alpha: 0,
            duration: 1800,
            repeat: -1,
            ease: "Sine.easeOut",
            onRepeat: () => {
                ring.setAlpha(0.8)
                ring.setScale(1)
            },
        })
    }

    spawnResultParticles() {
        const { width: w, height: h } = this.scale

        if (this.win) {
            // confetti-like rise
            for (let i = 0; i < 20; i++) {
                const p = this.add.circle(
                    Phaser.Math.Between(0, w),
                    h + Phaser.Math.Between(0, 100),
                    Phaser.Math.Between(2, 4),
                    [0x33ff66, 0x66ffaa, 0xffffff][Phaser.Math.Between(0, 2)],
                    0.9
                )
                this.tweens.add({
                    targets: p,
                    y: -50,
                    x: p.x + Phaser.Math.Between(-80, 80),
                    alpha: 0,
                    duration: Phaser.Math.Between(2500, 4000),
                    delay: Phaser.Math.Between(0, 1200),
                    onComplete: () => p.destroy(),
                })
            }
        } else {
            // slow falling ash
            for (let i = 0; i < 14; i++) {
                const p = this.add.circle(
                    Phaser.Math.Between(0, w),
                    -50,
                    Phaser.Math.Between(1, 2),
                    [0x662222, 0x442222, 0x221111][Phaser.Math.Between(0, 2)],
                    0.8
                )
                this.tweens.add({
                    targets: p,
                    y: h + 60,
                    x: p.x + Phaser.Math.Between(-30, 30),
                    alpha: 0,
                    duration: Phaser.Math.Between(3500, 5500),
                    delay: Phaser.Math.Between(0, 1500),
                    onComplete: () => p.destroy(),
                })
            }
        }
    }

    // ------------- Actions (unchanged) -------------
    requestRestart() {
        // guard if already waiting
        if (!this.restartButton?.input?.enabled) return // ✅ This is good

        if (this.roomCode) {
            socket.emit("playerReady", this.roomCode, "restart")
        }

        // ✅ Add debug logging
        console.log(`[GameOverScene] Restart requested for room ${this.roomCode}`);

        // update UI to waiting state
        this.restartButton.disableInteractive()
        this.restartButton.buttonText.setText("WAITING FOR OTHER PLAYER...")
        this.styleWaitingButton(this.restartButton)

        // spinner next to button
        this.addSpinner(this.restartButton.x + this.restartButton.buttonWidth / 2 + 40, this.restartButton.y)
    }


    goToMenu() {
        socket.emit("leaveGame")
        this.scene.stop()
        this.scene.start("StartScene")
    }

    styleWaitingButton(button) {
        const { buttonWidth: w, buttonHeight: h } = button
        const bg = button.bg
        bg.clear()
        bg.fillStyle(0x333333, 0.95)
        bg.fillRoundedRect(-w / 2, -h / 2, w, h, 24)
        bg.lineStyle(2, 0x777777, 1)
        bg.strokeRoundedRect(-w / 2, -h / 2, w, h, 24)
    }

    addSpinner(x, y) {
        const g = this.add.graphics({ x, y })
        const radius = 12
        const color = this.win ? 0x33ff66 : 0xff3344

        // draw arc
        g.lineStyle(4, color, 1)
        g.beginPath()
        g.arc(0, 0, radius, 0, Math.PI * 1.5)
        g.strokePath()

        this.tweens.add({
            targets: g,
            angle: 360,
            duration: 900,
            repeat: -1,
            ease: "Linear",
        })
    }

    // ------------- Cleanup (unchanged) -------------
    shutdown() {
        if (this._restartHandler) {
            socket.off("restartGame", this._restartHandler)
            this._restartHandler = null
        }
    }

    destroy() {
        this.shutdown()
        super.destroy()
    }
}