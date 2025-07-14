// WeatherEffectManager.js
import Phaser from 'phaser';
export class WeatherEffectManager {
    constructor(scene, apiManager) {
        this.scene = scene;
        this.api = apiManager;
        this.activeCode = null;
        this.lastStrikeTime = 0;
    }

    apply() {
        let code = this.api.getWeatherCode();
        code = 0;
        this.activeCode = code;
        console.log("Applying weather effect for code:", code);

        /**
         * 0 = Clear → Buff enemy speed
         * 1–3 = Cloudy → Vignette overlay
         * 45–48 = Fog → Fog overlay + reduce enemy sight
         * 51–67 = Drizzle/Rain → Player slips every few seconds
         * 71–77 = Snow → Slow down both player and enemies
         * 95–99 = Thunderstorm → Lightning strikes
        */
        if (code === 0) {
            this.buffEnemySpeed(1.3);
        } else if (code >= 1 && code <= 3) {
            this.addCloudOverlay();
        } else if (code >= 45 && code <= 48) {
            this.addFogOverlay();
            this.reduceEnemySight(0.5);
        } else if (code >= 51 && code <= 67) {
            this.enablePlayerSlips();
            this.addRainParticles();
        } else if (code >= 71 && code <= 77) {
            this.slowEveryone(0.6);
            this.addSnowParticles();
        } else if (code >= 95 && code <= 99) {
            this.addRainParticles();
            this.scheduleLightningStrikes();
        }
    }

    buffEnemySpeed(multiplier) {
        this.scene.enemies.children.iterate(enemy => {
            enemy.chaseSpeed *= multiplier;
        });
    }

    reduceEnemySight(factor) {
        this.scene.enemies.children.iterate(enemy => {
            enemy.detectionRadius *= factor;
        });
    }

    slowEveryone(factor) {
        this.scene.player.speed = (this.scene.player.speed || 150) * factor;
        this.scene.enemies.children.iterate(enemy => {
            enemy.chaseSpeed *= factor;
            enemy.wanderSpeed *= factor;
        });
    }

    addCloudOverlay() {
        const mapWidth = this.scene.map.widthInPixels;
        const mapHeight = this.scene.map.heightInPixels;

        const staticCloudKeys = ['cloud1', 'cloud2', 'cloud3', 'cloud4', 'cloud5'];
        const spacing = 100;

        if (this.staticClouds) {
            this.staticClouds.forEach(cloud => cloud.destroy());
        }
        if (this.clouds) {
            this.clouds.forEach(cloud => cloud.destroy());
        }
        this.staticClouds = [];
        this.clouds = [];

        if (this.cloudUpdateListener) {
            this.scene.events.off('update', this.cloudUpdateListener);
        }

        for (let x = 0; x < mapWidth; x += spacing) {
            for (let y = 0; y < mapHeight; y += spacing) {
                const offsetX = Phaser.Math.Between(-20, 20);
                const offsetY = Phaser.Math.Between(-20, 20);
                const key = Phaser.Utils.Array.GetRandom(staticCloudKeys);
                const cloud = this.scene.add.image(x + offsetX, y + offsetY, key)
                    .setDepth(450)
                    .setAlpha(1)
                    .setScale(Phaser.Math.FloatBetween(1.5, 2.5));
                this.staticClouds.push(cloud);
            }
        }

        // ✅ Moving Clouds - floating above static ones
        for (let i = 0; i < 60; i++) {
            const key = Phaser.Utils.Array.GetRandom(staticCloudKeys);
            const x = Phaser.Math.Between(0, mapWidth);
            const y = Phaser.Math.Between(0, mapHeight);
            const cloud = this.scene.add.image(x, y, key)
                .setDepth(500)
                .setAlpha(1)
                .setScale(Phaser.Math.FloatBetween(1.5, 3));

            cloud.speedX = Phaser.Math.FloatBetween(15, 25);
            cloud.baseY = y;
            this.clouds.push(cloud);
        }

        // ✅ Single update listener for movement
        this.cloudUpdateListener = (_, delta) => {
            this.clouds.forEach(cloud => {
                cloud.x += (cloud.speedX * delta) / 1000;
                if (cloud.x > mapWidth + 200) {
                    cloud.x = -200;
                    cloud.baseY = Phaser.Math.Between(0, mapHeight);
                }
            });
        };
        this.scene.events.on('update', this.cloudUpdateListener);
    }

    addRainParticles() {
        const cam = this.scene.cameras.main;

        this.rainEmitter = this.scene.add.particles(0, 0, 'rain', {
            lifespan: 800,
            speedY: { min: 600, max: 800 },
            scale: { start: 0.8, end: 0.4 },
            quantity: 6,
            frequency: 40,
            x: { min: 0, max: cam.width },
            y: { min: 0, max: 0 }, // spawn at the top edge
            angle: { min: 260, max: 280 }, // slight diagonal fall
            blendMode: 'ADD'
        }).setDepth(500);

        this.scene.events.on('update', () => {
            this.rainEmitter.setPosition(cam.scrollX, cam.scrollY);
        });
    }



    addSnowParticles() {
        const cam = this.scene.cameras.main;

        this.snowEmitter = this.scene.add.particles(0, 0, 'snow', {
            lifespan: 4000,
            speedY: { min: 50, max: 100 },
            speedX: { min: -20, max: 20 },
            scale: { start: 0.8, end: 0.4 },
            quantity: 3,
            frequency: 80,
            x: { min: 0, max: cam.width },
            y: { min: 0, max: cam.height * 0.5 },
            blendMode: 'NORMAL'
        }).setDepth(500);

        this.scene.events.on('update', () => {
            this.snowEmitter.setPosition(cam.scrollX, cam.scrollY);
        });
    }




    addFogOverlay() {
        const cam = this.scene.cameras.main;

        const fog = this.scene.add.rectangle(
            cam.centerX, cam.centerY,
            cam.displayWidth, cam.displayHeight,
            0xCCCCCC, 0.4
        )
            .setOrigin(0.5)
            .setScrollFactor(0)
            .setDepth(998);

        this.scene.fogOverlay = fog;

        this.scene.events.on('update', () => {
            const cam = this.scene.cameras.main;

            fog.setPosition(cam.centerX, cam.centerY);

            fog.setDisplaySize(cam.displayWidth, cam.displayHeight);
        });
    }




    enablePlayerSlips() {
        this.scene.time.addEvent({
            delay: 5000,
            loop: true,
            callback: () => {
                const player = this.scene.player;
                if (!player.active) return;

                // Prevent input during slip
                player.slipping = true;

                // Save drag
                const originalDragX = player.body.drag.x;
                const originalDragY = player.body.drag.y;

                // Lower drag for smooth slide
                player.setDrag(20, 20);

                // Push in a random direction
                const direction = new Phaser.Math.Vector2(
                    Phaser.Math.FloatBetween(-1, 1),
                    Phaser.Math.FloatBetween(-1, 1)
                ).normalize().scale(150); // adjust strength

                player.setVelocity(direction.x, direction.y);

                // Visual feedback
                player.setTint(0x66ccff);
                // this.scene.cameras.main.shake(200, 0.004);

                // After 800ms, restore control and drag
                this.scene.time.delayedCall(400, () => {
                    player.setDrag(originalDragX, originalDragY);
                    player.clearTint();
                    player.slipping = false;
                });
            }
        });
    }



    scheduleLightningStrikes() {
        this.scene.time.addEvent({
            delay: 3000,
            loop: true,
            callback: () => this.strikeLightning()
        });
    }

    strikeLightning() {
        const x = Phaser.Math.Between(0, this.scene.map.widthInPixels);
        const y = Phaser.Math.Between(0, this.scene.map.heightInPixels);

        const lightning = this.scene.add.image(x, y, 'lightning')
            .setDepth(1000)
            .setScale(2)
            .setOrigin(0.5)
            .setAlpha(0);

        // Quick fade-in
        this.scene.tweens.add({
            targets: lightning,
            alpha: 1,
            duration: 100,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                // Quick fade-out after flash
                this.scene.tweens.add({
                    targets: lightning,
                    alpha: 0,
                    duration: 200,
                    ease: 'Cubic.easeOut',
                    onComplete: () => lightning.destroy()
                });
            }
        });

        // Screen shake for thunder impact
        this.scene.cameras.main.shake(250, 0.01);

        // Damage entities in blast radius
        const radius = 50;
        const playerDist = Phaser.Math.Distance.Between(x, y, this.scene.player.x, this.scene.player.y);
        if (playerDist < radius && !this.scene.player.invulnerable) {
            this.scene.player.hp--;
            this.scene.player.setTint(0xff0000);
            this.scene.time.delayedCall(100, () => this.scene.player.clearTint());
        }

        this.scene.enemies.children.iterate(enemy => {
            if (!enemy.active) return;
            if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) < radius) {
                enemy.takeDamage(2);
            }
        });
    }


}
