import Phaser from "phaser";

export default class ScoreOverviewScene extends Phaser.Scene {
    constructor() {
        super("ScoreOverviewScene");
    }

    init(data) {
        this.stats = data;
    }

    preload() {
        // Minimal particle sprite (1x1 white)
        this.load.image(
            "particle",
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAFfcULOdwAAAABJRU5ErkJggg=="
        );

        // Generate reusable rounded rectangle textures (glass panel, pill buttons, stat bars)
        this.createRoundedRectTexture({
            key: "panel-560x520",
            w: 560,
            h: 520,
            r: 24,
            fill: 0x0b0d12,
            fillAlpha: 0.78,
            stroke: 0xffd042,
            strokeAlpha: 0.65,
            strokeWidth: 3
        });

        this.createRoundedRectTexture({
            key: "panel-inner-550x510",
            w: 550,
            h: 510,
            r: 18,
            fill: 0xffffff,
            fillAlpha: 0.02,
            stroke: 0xffd042,
            strokeAlpha: 0.35,
            strokeWidth: 1
        });

        this.createRoundedRectTexture({
            key: "btn-200x56",
            w: 200,
            h: 56,
            r: 28,
            fill: 0x0b0d12,
            fillAlpha: 0.88,
            stroke: 0x33ff66,
            strokeAlpha: 1,
            strokeWidth: 2
        });

        this.createRoundedRectTexture({
            key: "btn-200x56-red",
            w: 200,
            h: 56,
            r: 28,
            fill: 0x0b0d12,
            fillAlpha: 0.88,
            stroke: 0xff3344,
            strokeAlpha: 1,
            strokeWidth: 2
        });

        this.createRoundedRectTexture({
            key: "stat-240x24",
            w: 240,
            h: 24,
            r: 8,
            fill: 0x1a1f27,
            fillAlpha: 0.65,
            stroke: 0xffffff,
            strokeAlpha: 0.08,
            strokeWidth: 1
        });

        // Soft round glow sprite
        this.createRadialGlowTexture("glow-256", 256, 0xffd042, 0.6);
    }

    create() {
        const { width: w, height: h } = this.scale;
        const cx = w / 2, cy = h / 2;

        this.cameras.main.fadeIn(600, 0, 0, 0);

        // Layered background: gradient + beams + vignette + slow parallax light
        this.createGradientBackground();
        this.createLightBeams();
        this.createVignette();
        this.createPointerGlow();

        // Glass panel container
        const panel = this.add.container(cx, cy);
        panel.setDepth(10);

        // Panel images (outer + subtle inner)
        panel.add(this.add.image(0, 0, "panel-560x520"));
        panel.add(this.add.image(0, 0, "panel-inner-550x510"));

        // Subtle parallax tilt on pointer
        this.input.on("pointermove", (p) => {
            const dx = (p.x - cx) / w;
            const dy = (p.y - cy) / h;
            panel.setRotation(Phaser.Math.Clamp(dx * 0.08, -0.08, 0.08));
            panel.list.forEach((child, i) => {
                if (child.setDepth) child.setDepth(i);
                if (child.setX && child.setY && i > 0) {
                    child.setX((i % 2 === 0 ? 1 : -1) * dx * 4);
                    child.setY(dy * 4);
                }
            });
        });

        // Title
        this.createTitle(cx, cy - 210);

        // Stats (two columns for better rhythm)
        this.createStatsGrid(cx, cy - 140);

        // Buttons
        this.createButtons(cx, cy + 190);

        // Footer
        this.createFooter(cx, h);

        // Ambient particles
        this.createFloatingParticles();

        // Shortcuts
        this.setupKeyboardShortcuts();

        // Entrance animations
        this.addEntranceAnimations();
    }

    // ---------- Visual Builders ----------

    createGradientBackground() {
        const { width: w, height: h } = this.scale;
        const g = this.add.graphics();
        // Vertical gradient stripes
        for (let i = 0; i < h; i += 3) {
            const t = i / h;
            const r = Phaser.Math.Linear(10, 24, t);
            const gC = Phaser.Math.Linear(12, 22, t);
            const b = Phaser.Math.Linear(18, 28, t);
            g.fillStyle(Phaser.Display.Color.GetColor(r, gC, b));
            g.fillRect(0, i, w, 3);
        }
        // Subtle grid
        g.lineStyle(1, 0xffffff, 0.06);
        for (let x = 0; x < w; x += 48) { g.lineBetween(x, 0, x, h); }
        for (let y = 0; y < h; y += 48) { g.lineBetween(0, y, w, y); }
        g.setDepth(-5);
    }

    createLightBeams() {
        const { width: w, height: h } = this.scale;
        const beams = this.add.graphics().setDepth(-4);
        beams.save();
        beams.translateCanvas(w * 0.2, -h * 0.1);
        beams.rotateCanvas(Phaser.Math.DegToRad(25));
        for (let i = 0; i < 6; i++) {
            beams.fillStyle(0xffd042, 0.025 + i * 0.01);
            beams.fillRect(i * 80, 0, 40, h * 1.6);
        }
        beams.restore();
        this.tweens.add({
            targets: beams,
            alpha: { from: 0.4, to: 0.7 },
            duration: 5000,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });
    }

    createVignette() {
        const { width: w, height: h } = this.scale;
        const v = this.add.graphics().setDepth(5);
        const steps = 42;
        for (let i = 0; i < steps; i++) {
            const a = (i / steps) * 0.45;
            const r = ((w + h) / 2) * (1 - i / steps);
            v.fillStyle(0x000000, a);
            v.fillCircle(w / 2, h / 2, r);
        }
    }

    createPointerGlow() {
        const glow = this.add.image(this.scale.width / 2, this.scale.height / 2, "glow-256")
            .setBlendMode(Phaser.BlendModes.ADD)
            .setAlpha(0.6)
            .setDepth(-2);
        this.input.on("pointermove", (p) => {
            this.tweens.add({
                targets: glow,
                x: p.x + 60,
                y: p.y + 40,
                duration: 250,
                ease: "Quad.easeOut"
            });
        });
        this.tweens.add({
            targets: glow,
            alpha: { from: 0.4, to: 0.7 },
            duration: 3000,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });
    }

    createTitle(x, y) {
        const main = this.add.text(x, y, "RUN OVERVIEW", {
            fontFamily: "Arial",
            fontStyle: "bold",
            fontSize: "40px",
            color: "#ffd042",
            stroke: "#000000",
            strokeThickness: 6
        }).setOrigin(0.5).setDepth(999);
        main.setShadow(0, 4, "#000000", 8, true, true);

        const glow = this.add.text(x, y, "RUN OVERVIEW", {
            fontFamily: "Arial",
            fontStyle: "bold",
            fontSize: "40px",
            color: "#ffd042"
        }).setOrigin(0.5).setAlpha(0.35)
            .setBlendMode(Phaser.BlendModes.ADD).setDepth(999);

        this.tweens.add({
            targets: [main, glow],
            scaleX: 1.03,
            scaleY: 1.03,
            duration: 2200,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
        });

        this.add.text(x, y + 32, "Battle statistics", {
            fontFamily: "Arial",
            fontSize: "18px",
            color: "#c9d1d9",
            stroke: "#000000",
            strokeThickness: 2
        }).setOrigin(0.5).setDepth(999);
    }

    createStatsGrid(cx, topY) {
        const leftX = cx - 230;
        const rightX = cx + 230 - 240; // align right column
        const rowH = 32;

        const stats = [
            { label: "Final Score", value: this.stats.score, color: "#ffd042", icon: "🏆" },
            { label: "Time Survived", value: `${this.stats.timeSurvived}s`, color: "#66ff66", icon: "⏱️" },
            { label: "Level Reached", value: this.stats.level, color: "#ff6666", icon: "📈" },
            { label: "Enemies Killed", value: this.stats.kills, color: "#ff9966", icon: "" },
            { label: "Blood Crystals (Lv1)", value: this.stats.bloodCrystals1, color: "#ff3366", icon: "" },
            { label: "Blood Crystals (Lv2)", value: this.stats.bloodCrystals2, color: "#ff3366", icon: "" },
            { label: "Blood Crystals (Lv3)", value: this.stats.bloodCrystals3, color: "#ff3366", icon: "" },
            { label: "Mystery Buffs", value: this.stats.mysteryBuffs, color: "#66ccff", icon: "" },
            { label: "Mystery Nerfs", value: this.stats.mysteryNerfs, color: "#ff6666", icon: "" },
            { label: "Weathers Endured", value: this.stats.weatherCount, color: "#99ff99", icon: "" }
        ];

        // Split into two columns
        const mid = Math.ceil(stats.length / 2);
        const leftCol = stats.slice(0, mid);
        const rightCol = stats.slice(mid);

        leftCol.forEach((s, i) => this.drawStatRow(leftX, topY + i * rowH, s));
        rightCol.forEach((s, i) => this.drawStatRow(rightX, topY + i * rowH, s));
    }

    drawStatRow(x, y, stat) {
        // Background bar
        const bar = this.add.image(x, y, "stat-240x24").setOrigin(0, 0.5);
        // Icon (exclude duplicate decorative emojis)
        if (stat.icon && stat.icon !== "💎" && stat.icon !== "⚔️") {
            this.add.text(x + 10, y, stat.icon, {
                fontFamily: "Arial",
                fontSize: "14px",
                color: stat.color
            }).setOrigin(0.5).setDepth(999);
        }

        // Label
        this.add.text(x + 28, y, stat.label, {
            fontFamily: "Arial",
            fontSize: "14px",
            color: "#e6edf3",
            stroke: "#000000",
            strokeThickness: 2
        }).setOrigin(0, 0.5).setDepth(999);

        // Value
        const value = this.add.text(x + 232, y, `${stat.value}`, {
            fontFamily: "Arial",
            fontStyle: "bold",
            fontSize: "16px",
            color: stat.color,
            stroke: "#000000",
            strokeThickness: 3
        }).setOrigin(1, 0.5).setDepth(999);

        // Light additive glow for top stats
        if (["Final Score", "Time Survived", "Level Reached"].includes(stat.label)) {
            const glow = this.add.text(x + 232, y, `${stat.value}`, {
                fontFamily: "Arial",
                fontStyle: "bold",
                fontSize: "16px",
                color: stat.color
            }).setOrigin(1, 0.5).setAlpha(0.28).setBlendMode(Phaser.BlendModes.ADD).setDepth(999);

            this.tweens.add({
                targets: [value, glow],
                alpha: { from: 1, to: 0.9 },
                duration: 2000,
                yoyo: true,
                repeat: -1,
                ease: "Sine.easeInOut"
            });
        }
    }

    createButtons(cx, y) {
        // Restart (green)
        this.restartButton = this.createEnhancedButton({
            x: cx - 110,
            y,
            label: "🔄 RESTART",
            color: "#33ff66",
            textureKey: "btn-200x56",
            onClick: () => {
                this.cameras.main.fadeOut(300, 0, 0, 0);
                this.time.delayedCall(300, () => {
                    this.scene.stop();
                    this.scene.start("Arena1_New");
                });
            }
        });

        // Main menu (red)
        this.menuButton = this.createEnhancedButton({
            x: cx + 110,
            y,
            label: "🏠 MAIN MENU",
            color: "#ff3344",
            textureKey: "btn-200x56-red",
            onClick: () => {
                this.cameras.main.fadeOut(300, 0, 0, 0);
                this.time.delayedCall(300, () => {
                    this.scene.stop();
                    this.scene.start("StartScene");
                });
            }
        });
    }

    createEnhancedButton({ x, y, label, color, textureKey, onClick }) {
        const container = this.add.container(x, y);
        const bg = this.add.image(0, 0, textureKey);
        const text = this.add.text(0, 0, label, {
            fontFamily: "Arial",
            fontStyle: "bold",
            fontSize: "18px",
            color: "#e6edf3",
            stroke: "#000000",
            strokeThickness: 3
        }).setOrigin(0.5);
        container.add([bg, text]);

        container.setSize(bg.width, bg.height);
        container.setInteractive(new Phaser.Geom.Rectangle(-bg.width / 2, -bg.height / 2, bg.width, bg.height), Phaser.Geom.Rectangle.Contains).setDepth(20);

        // Hover micro-interaction
        container.on("pointerover", () => {
            this.tweens.add({ targets: container, scale: 1.06, duration: 140, ease: "Power2" });
            text.setColor(color);
            const glow = this.add.image(container.x, container.y, "glow-256")
                .setBlendMode(Phaser.BlendModes.ADD)
                .setAlpha(0.35)
                .setScale(0.8)
                .setDepth(19);
            container.glow = glow;
        });

        container.on("pointerout", () => {
            this.tweens.add({ targets: container, scale: 1, duration: 140, ease: "Power2" });
            text.setColor("#e6edf3");
            container.glow?.destroy();
            container.glow = undefined;
        });

        container.on("pointerdown", () => {
            this.tweens.add({
                targets: container,
                scale: 0.95,
                duration: 100,
                yoyo: true,
                onComplete: onClick
            });
        });

        return container;
    }

    createFooter(cx, h) {
        const g = this.add.graphics();
        g.fillStyle(0x000000, 0.7);
        g.fillRoundedRect(cx - 220, h - 54, 440, 40, 16);
        g.lineStyle(1, 0xffffff, 0.15);
        g.strokeRoundedRect(cx - 220, h - 54, 440, 40, 16);
        this.add.text(cx, h - 34, "R = Restart  •  M = Main Menu", {
            fontFamily: "Arial",
            fontSize: "14px",
            color: "#c9d1d9",
            stroke: "#000000",
            strokeThickness: 2
        }).setOrigin(0.5);
    }

    createFloatingParticles() {
        // Warm ambient specks
        this.add.particles(this.scale.width / 2, this.scale.height / 2, "particle", {
            x: { min: 0, max: this.scale.width },
            y: { min: 0, max: this.scale.height },
            scale: { min: 0.3, max: 1.1 },
            alpha: { min: 0.08, max: 0.25 },
            tint: [0xffd042, 0xffc065, 0xff9966],
            speed: { min: 6, max: 18 },
            lifespan: { min: 5000, max: 9000 },
            frequency: 380,
            blendMode: "ADD"
        }).setDepth(-3);
    }

    setupKeyboardShortcuts() {
        this.input.keyboard.on("keydown-R", () => this.restartButton.emit("pointerdown"));
        this.input.keyboard.on("keydown-M", () => this.menuButton.emit("pointerdown"));
    }

    addEntranceAnimations() {
        const fadeIn = (targets, delayBase = 0) =>
            this.tweens.add({
                targets,
                alpha: { from: 0, to: 1 },
                y: (t) => t.y - 30,
                duration: 600,
                delay: (i) => delayBase + i * 80,
                ease: "Back.easeOut"
            });

        fadeIn([this.restartButton, this.menuButton], 700);
    }

    // ---------- Texture Helpers ----------

    createRoundedRectTexture({ key, w, h, r, fill, fillAlpha, stroke, strokeAlpha, strokeWidth }) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(fill, fillAlpha ?? 1);
        g.fillRoundedRect(0, 0, w, h, r);
        if (strokeWidth && strokeAlpha) {
            g.lineStyle(strokeWidth, stroke, strokeAlpha);
            g.strokeRoundedRect(0, 0, w, h, r);
            // Inner highlight
            g.lineStyle(1, stroke, (strokeAlpha ?? 1) * 0.5);
            g.strokeRoundedRect(2, 2, w - 4, h - 4, Math.max(2, r - 4));
        }
        g.generateTexture(key, w, h);
        g.destroy();
    }

    createRadialGlowTexture(key, size, color, alpha = 0.6) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        const steps = 64;
        for (let i = steps; i >= 1; i--) {
            const a = alpha * (i / steps) ** 2;
            const r = (size / 2) * (i / steps);
            g.fillStyle(color, a);
            g.fillCircle(size / 2, size / 2, r);
        }
        g.generateTexture(key, size, size);
        g.destroy();
    }
}