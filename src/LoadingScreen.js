import Phaser from "phaser";

export class LoadingScene extends Phaser.Scene {
    constructor() {
        super("LoadingScene");
        this.loadingProgress = 0;
        this.targetProgress = 100;
        this.loadingText = null;
        this.progressBar = null;
        this.progressBarBg = null;
        this.loadingTips = [
            "Stay alert - enemies can come from any direction",
            "Collect blood orbs to increase your power",
            "Use walls and obstacles for tactical advantage",
            "Your survival depends on quick reflexes",
            "The longer you survive, the stronger enemies become",
            "Master your movement to avoid deadly attacks",
            "Every second counts in the bloodthirst arena"
        ];
        this.currentTip = "";
    }

    init(data) {
        this.nextScene = data?.nextScene || "Arena1_New";
    }


    preload() {
        // Create a simple white pixel for effects
        this.load.image('particle', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAFfcULOdwAAAABJRU5ErkJggg==');

        // Load everything for Arena1
        // Load tilemap and tile images
        this.load.tilemapTiledJSON("Arena1_New", "assets/Arena1_New.json");

        this.load.image("tileset", "assets/Texture/TX Tileset Grass.png");
        this.load.image("objects", "assets/Texture/TX Tileset Wall.png");
        this.load.image("structure", "assets/Texture/TX Struct.png");
        this.load.image("plants", "assets/Texture/Extra/TX Plant with Shadow.png");
        this.load.image("props", "assets/Texture/Extra/TX Props with Shadow.png");
        this.load.image("concrete", "assets/Texture/TX Tileset Stone Ground.png");

        this.load.image('vignette', 'assets/vignette.png');
        this.load.image('rain', 'assets/rain.png');
        this.load.image('snow', 'assets/snowflake.png');
        this.load.image('lightning', 'assets/lightning_line3a7.png');
        this.load.image('cloud1', 'assets/Cloud1.png');
        this.load.image('cloud2', 'assets/Cloud2.png');
        this.load.image('cloud3', 'assets/Cloud3.png');
        this.load.image('cloud4', 'assets/Cloud4.png');
        this.load.image('cloud5', 'assets/Cloud5.png');

        this.loadAnimationSpriteSheets();
        this.loadAudioFiles();
    }

    create() {
        // Create gradient background
        this.createGradientBackground();

        // Add atmospheric particles
        this.createParticleSystem();

        // Loading title
        const loadingTitle = this.add.text(this.scale.width / 2, this.scale.height / 3, "ENTERING ARENA", {
            font: "bold 48px Arial",
            fill: "#ff0033",
            stroke: "#000000",
            strokeThickness: 3
        }).setOrigin(0.5);

        // Add glow effect to title
        const titleGlow = this.add.text(this.scale.width / 2, this.scale.height / 3, "ENTERING ARENA", {
            font: "bold 48px Arial",
            fill: "#ff0033",
            alpha: 0.3
        }).setOrigin(0.5);
        titleGlow.setBlendMode(Phaser.BlendModes.ADD);

        // Pulsing animation for title
        this.tweens.add({
            targets: [loadingTitle, titleGlow],
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Create progress bar background
        this.progressBarBg = this.add.graphics();
        this.progressBarBg.fillStyle(0x000000, 0.8);
        this.progressBarBg.fillRoundedRect(this.scale.width / 2 - 200, this.scale.height / 2 + 20, 400, 30, 15);
        this.progressBarBg.lineStyle(2, 0x666666, 1);
        this.progressBarBg.strokeRoundedRect(this.scale.width / 2 - 200, this.scale.height / 2 + 20, 400, 30, 15);

        // Create progress bar
        this.progressBar = this.add.graphics();

        // Loading percentage text
        this.loadingText = this.add.text(this.scale.width / 2, this.scale.height / 2 + 35, "0%", {
            font: "bold 20px Arial",
            fill: "#ffffff",
            stroke: "#000000",
            strokeThickness: 1
        }).setOrigin(0.5);

        // Loading status text
        this.statusText = this.add.text(this.scale.width / 2, this.scale.height / 2 - 20, "Preparing Arena...", {
            font: "18px Arial",
            fill: "#cccccc",
            stroke: "#000000",
            strokeThickness: 1
        }).setOrigin(0.5);

        // Random loading tip
        this.currentTip = this.loadingTips[Math.floor(Math.random() * this.loadingTips.length)];
        this.tipText = this.add.text(this.scale.width / 2, this.scale.height * 0.75, this.currentTip, {
            font: "16px Arial",
            fill: "#ffaa00",
            stroke: "#000000",
            strokeThickness: 1,
            wordWrap: { width: this.scale.width - 100 },
            align: 'center'
        }).setOrigin(0.5);

        // Add floating blood drops
        this.createFloatingDrops();

        // Start fake loading process
        this.startFakeLoading();

        // Add spinning loading indicator
        this.createLoadingSpinner();
    }

    createGradientBackground() {
        const graphics = this.add.graphics();

        // Create gradient effect
        for (let i = 0; i < this.scale.height; i += 4) {
            const progress = i / this.scale.height;
            const r = Math.floor(20 + (40 - 20) * progress);
            const g = Math.floor(20 + (10 - 20) * progress);
            const b = Math.floor(20 + (10 - 20) * progress);

            graphics.fillStyle(Phaser.Display.Color.GetColor(r, g, b));
            graphics.fillRect(0, i, this.scale.width, 4);
        }
    }

    createParticleSystem() {
        // Dark red floating particles
        const particles = this.add.particles(this.scale.width / 2, this.scale.height / 2, 'particle', {
            x: { min: 0, max: this.scale.width },
            y: { min: 0, max: this.scale.height },
            scale: { min: 0.3, max: 1.5 },
            alpha: { min: 0.1, max: 0.2 },
            tint: [0x660011, 0x440008, 0x220004],
            speed: { min: 3, max: 15 },
            lifespan: { min: 5000, max: 8000 },
            frequency: 400,
            blendMode: 'ADD'
        });

        particles.setDepth(-1);
    }

    createLoadingSpinner() {
        // Create spinning loading indicator
        this.spinner = this.add.graphics();
        this.spinner.lineStyle(4, 0xff0033, 1);
        this.spinner.beginPath();
        this.spinner.arc(this.scale.width / 2 + 220, this.scale.height / 2 + 35, 15, 0, Math.PI * 1.5);
        this.spinner.strokePath();

        // Spinning animation
        this.tweens.add({
            targets: this.spinner,
            rotation: Math.PI * 2,
            duration: 1000,
            repeat: -1,
            ease: 'Linear'
        });
    }

    createFloatingDrops() {
        // Add floating blood drops for atmosphere
        for (let i = 0; i < 10; i++) {
            const drop = this.add.circle(
                Phaser.Math.Between(0, this.scale.width),
                Phaser.Math.Between(this.scale.height, this.scale.height + 100),
                Phaser.Math.Between(2, 4),
                0xff0033,
                0.6
            );

            this.tweens.add({
                targets: drop,
                y: -50,
                x: drop.x + Phaser.Math.Between(-20, 20),
                alpha: 0,
                duration: Phaser.Math.Between(3000, 6000),
                delay: Phaser.Math.Between(0, 2000),
                repeat: -1,
                onRepeat: () => {
                    drop.setPosition(
                        Phaser.Math.Between(0, this.scale.width),
                        this.scale.height + Phaser.Math.Between(0, 50)
                    );
                    drop.setAlpha(0.6);
                }
            });
        }
    }

    startFakeLoading() {
        const loadingSteps = [
            { progress: 15, status: "Loading Arena Layout...", duration: 800 },
            { progress: 30, status: "Spawning Enemies...", duration: 600 },
            { progress: 45, status: "Initializing Combat System...", duration: 700 },
            { progress: 60, status: "Loading Weapons...", duration: 500 },
            { progress: 75, status: "Setting Up Physics...", duration: 600 },
            { progress: 90, status: "Final Preparations...", duration: 400 },
            { progress: 100, status: "Ready to Fight!", duration: 300 }
        ];

        let currentStep = 0;

        const executeStep = () => {
            if (currentStep < loadingSteps.length) {
                const step = loadingSteps[currentStep];

                // Update status text
                this.statusText.setText(step.status);

                // Animate progress bar
                this.tweens.add({
                    targets: this,
                    loadingProgress: step.progress,
                    duration: step.duration,
                    ease: 'Power2.easeOut',
                    onUpdate: () => {
                        this.updateProgressBar();
                    },
                    onComplete: () => {
                        currentStep++;
                        if (currentStep < loadingSteps.length) {
                            this.time.delayedCall(200, executeStep);
                        } else {
                            // Loading complete - transition to game
                            this.time.delayedCall(500, () => {
                                this.transitionToGame();
                            });
                        }
                    }
                });
            }
        };

        // Start loading after a brief delay
        this.time.delayedCall(500, executeStep);
    }

    updateProgressBar() {
        // Clear and redraw progress bar
        this.progressBar.clear();

        const barWidth = (this.loadingProgress / 100) * 396; // 396 = 400 - 4 (border)

        // Create gradient effect for progress bar
        if (barWidth > 0) {
            for (let i = 0; i < barWidth; i += 2) {
                const progress = i / 396;
                const r = Math.floor(255 * (0.4 + 0.6 * progress));
                const g = Math.floor(51 * (0.2 + 0.8 * progress));
                const b = Math.floor(51 * (0.2 + 0.8 * progress));

                this.progressBar.fillStyle(Phaser.Display.Color.GetColor(r, g, b));
                this.progressBar.fillRect(this.scale.width / 2 - 198 + i, this.scale.height / 2 + 22, 2, 26);
            }
        }

        // Update percentage text
        this.loadingText.setText(Math.floor(this.loadingProgress) + "%");

        // Add glow effect when near completion
        if (this.loadingProgress > 80) {
            this.progressBar.lineStyle(2, 0xff0033, 0.8);
            this.progressBar.strokeRoundedRect(this.scale.width / 2 - 200, this.scale.height / 2 + 20, 400, 30, 15);
        }
    }

    transitionToGame() {
        // Flash effect before transition
        const flash = this.add.graphics();
        flash.fillStyle(0xffffff, 0);
        flash.fillRect(0, 0, this.scale.width, this.scale.height);

        this.tweens.add({
            targets: flash,
            alpha: 0.8,
            duration: 200,
            yoyo: true,
            onComplete: () => {
                // Start the actual game scene
                this.scene.start(this.nextScene);
            }
        });

        // Update status text
        this.statusText.setText("Entering Combat Zone...");
        this.statusText.setStyle({ fill: "#33ff33" });
    }

    loadAudioFiles() {
        this.load.audio('shard_collect', 'assets/Audio/Shard_Collected.mp3');
        this.load.audio('weather_change_alert', 'assets/Audio/Weather_Change_Alert.mp3');
        this.load.audio('game_over', 'assets/Audio/Game_Over.mp3');
        this.load.audio('rain', 'assets/Audio/Rain.mp3');
        this.load.audio('thunder', 'assets/Audio/Thunder.mp3');
        this.load.audio('vampire_hurt', 'assets/Audio/Vampire_Hurt.mp3');
        this.load.audio('vampire_die', 'assets/Audio/Vampire_Die.wav');
        this.load.audio('running_on_grass', 'assets/Audio/Running_on_Grass.mp3');
        this.load.audio('running_on_wet_grass', 'assets/Audio/Running_on_Wet_Grass.mp3');
        this.load.audio('player_attack', 'assets/Audio/Player_Attack.mp3');
        this.load.audio('player_hurt', 'assets/Audio/Player_Hurt.mp3');
        this.load.audio('running_on_snow', 'assets/Audio/Running_on_Snow.mp3');
        this.load.audio('snow', 'assets/Audio/Snow.mp3');
    }

    loadAnimationSpriteSheets() {
        const dirs = ['up', 'down', 'left', 'right'];

        // Load player animations
        dirs.forEach(dir => {
            this.load.spritesheet(`main_run_${dir}`, `assets/Sprite/Main/RUN/run_${dir}.png`, { frameWidth: 96, frameHeight: 80 });
            this.load.spritesheet(`main_idle_${dir}`, `assets/Sprite/Main/IDLE/idle_${dir}.png`, { frameWidth: 96, frameHeight: 80 });
            this.load.spritesheet(`main_attack_${dir}`, `assets/Sprite/Main/ATTACK/attack1_${dir}.png`, { frameWidth: 96, frameHeight: 80 });
        });

        // Load vampire 1
        this.load.spritesheet("vampire1_walk", "assets/Sprite/Vampires1/Walk/Vampires1_Walk_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_run", "assets/Sprite/Vampires1/Run/Vampires1_Run_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_idle", "assets/Sprite/Vampires1/Idle/Vampires1_Idle_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_attack", "assets/Sprite/Vampires1/Attack/Vampires1_Attack_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_death", "assets/Sprite/Vampires1/Death/Vampires1_Death_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire1_hurt", "assets/Sprite/Vampires1/Hurt/Vampires1_Hurt_full.png", { frameWidth: 64, frameHeight: 64 });

        // Load vampire 2
        this.load.spritesheet("vampire2_walk", "assets/Sprite/Vampires2/Walk/Vampires2_Walk_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire2_run", "assets/Sprite/Vampires2/Run/Vampires2_Run_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire2_idle", "assets/Sprite/Vampires2/Idle/Vampires2_Idle_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire2_attack", "assets/Sprite/Vampires2/Attack/Vampires2_Attack_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire2_death", "assets/Sprite/Vampires2/Death/Vampires2_Death_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire2_hurt", "assets/Sprite/Vampires2/Hurt/Vampires2_Hurt_full.png", { frameWidth: 64, frameHeight: 64 });

        // Load vampire 3
        this.load.spritesheet("vampire3_walk", "assets/Sprite/Vampires3/Walk/Vampires3_Walk_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire3_run", "assets/Sprite/Vampires3/Run/Vampires3_Run_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire3_idle", "assets/Sprite/Vampires3/Idle/Vampires3_Idle_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire3_attack", "assets/Sprite/Vampires3/Attack/Vampires3_Attack_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire3_death", "assets/Sprite/Vampires3/Death/Vampires3_Death_full.png", { frameWidth: 64, frameHeight: 64 });
        this.load.spritesheet("vampire3_hurt", "assets/Sprite/Vampires3/Hurt/Vampires3_Hurt_full.png", { frameWidth: 64, frameHeight: 64 });

        // Load blood crystal
        this.load.spritesheet("blood_crystal", "assets/Items/BloodCrystal.png", { frameWidth: 384, frameHeight: 512 });
        this.load.image('crystal', 'assets/Items/Crystal.png'); // Adjust the path as needed

    }
}