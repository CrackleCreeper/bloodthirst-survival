// WeatherEffectManager.js
import Phaser from 'phaser';
export class WeatherEffectManager {
    constructor(scene, apiManager, isMultiplayer = false) {
        this.scene = scene;
        this.api = apiManager;
        this.activeCode = null;
        this.isRaining = false;
        this.isSnowing = false;
        this.lastStrikeTime = 0;
        this.isMultiplayer = isMultiplayer;
        this.roundCount = 1;
    }

    apply() {
        this.scene.sound.play('weather_change_alert', { volume: 0.3 });
        this.isRaining = false;
        this.isSnowing = false;
        let roundCount = this.roundCount;
        let code = this.api.getWeatherCode();
        // code = 75; // Force a specific code for testing
        if (code >= 1 && code <= 3) {
            // Soft reroll
            for (let i = 0; i < 2; i++) {
                this.api.fetchWeather();
                const reroll = this.api.getWeatherCode();
                if (reroll < 1 || reroll > 3) {
                    code = reroll;
                    break;
                }
            }
        }
        if (roundCount % 5 === 0) {
            code = Phaser.Math.RND.pick([0, 77, 99]); // Clear, Snow, Thunderstorm
        }


        const description = this.getWeatherDescription(code);
        const gameplayEffect = this.getGameplayEffectText(code);

        // Step 1: Show "Changing Weather..."
        this.showWeatherChangeText();

        // Step 2: Delay applying weather effects
        this.scene.time.delayedCall(2000, () => {
            this.reset();
            this.activeCode = code;
            console.log("Applying weather effect for code:", code);
            this.roundCount++;
            // Step 3: Show gameplay impact text
            this.showGameplayEffectText(description, gameplayEffect);

            // Apply actual effects
            // Clear any existing sound that is playing
            this.scene.sound.stopByKey('rain');
            if (code >= 0 && code <= 2) this.buffEnemySpeed(1.3);
            else if (code >= 3 && code <= 9) this.addCloudOverlay();
            else if (code >= 40 && code <= 49) {
                this.addFogOverlay();
                this.reduceEnemySight(0.5);
            }
            else if (code >= 51 && code <= 67) {
                this.scene.sound.play('rain', { loop: true, volume: 0.1 });
                this.isRaining = true;
                this.enablePlayerSlips();
                this.addRainParticles();
            }
            else if (code >= 71 && code <= 77) {
                this.scene.sound.play('snow', { loop: true, volume: 1 });
                this.isSnowing = true;
                this.slowEveryone(0.6);
                this.addSnowParticles();
            }
            else if ((code >= 95 && code <= 99) || code == 80) {
                this.scene.sound.play('rain', { loop: true, volume: 0.1 });
                this.isRaining = true;
                this.addRainParticles();
                this.scheduleLightningStrikes();
            }

            // Update permanent corner text
            this.scene.weatherText.setText(`Weather: ${description}`);
        });
    }

    applyFromCode(code) {
        this.activeCode = code;
        this.roundCount++; // Optional: increment counter
        this.scene.sound.play('weather_change_alert', { volume: 0.3 });

        const description = this.getWeatherDescription(code);
        const gameplayEffect = this.getGameplayEffectText(code);

        this.showWeatherChangeText();

        this.scene.time.delayedCall(2000, () => {
            this.reset();
            console.log("Applying weather effect from server:", code);

            this.showGameplayEffectText(description, gameplayEffect);

            this.scene.sound.stopByKey('rain');
            if (code >= 0 && code <= 2) this.buffEnemySpeed(1.3);
            else if (code >= 3 && code <= 9) this.addCloudOverlay();
            else if (code >= 40 && code <= 49) {
                this.addFogOverlay();
                this.reduceEnemySight(0.5);
            }
            else if (code >= 51 && code <= 67) {
                this.scene.sound.play('rain', { loop: true, volume: 0.1 });
                this.isRaining = true;
                this.enablePlayerSlips();
                this.addRainParticles();
            }
            else if (code >= 71 && code <= 77) {
                this.scene.sound.play('snow', { loop: true, volume: 1 });
                this.isSnowing = true;
                this.slowEveryone(0.6);
                this.addSnowParticles();
            }
            else if ((code >= 95 && code <= 99) || code == 80) {
                this.scene.sound.play('rain', { loop: true, volume: 0.1 });
                this.isRaining = true;
                this.addRainParticles();
                this.scheduleLightningStrikes();
            }

            // Update weather corner text
            this.scene.weatherText.setText(`Weather: ${description}`);
        });
    }



    reset() {
        // Remove overlays
        if (this.scene.fogOverlay) this.scene.fogOverlay.destroy();
        if (this.rainEmitter) this.rainEmitter.stop();
        if (this.snowEmitter) this.snowEmitter.stop();
        if (this.lightningStrikeEvent) {
            this.scene.time.removeEvent(this.lightningStrikeEvent);
            this.lastStrikeTime = 0; // Reset last strike time
        }
        if (this.slippingEvent) {
            this.scene.time.removeEvent(this.slippingEvent);
            if (!this.isMultiplayer)
                this.scene.player.slipping = false; // Reset player state
            else {
                if (this.scene.frontendPlayers[window.socket.id])
                    this.scene.frontendPlayers[window.socket.id].slipping = false;
            }
        }

        if (this.cloudUpdateListener) this.scene.events.off('update', this.cloudUpdateListener);
        if (this.clouds) this.clouds.forEach(c => c.destroy());
        if (this.staticClouds) this.staticClouds.forEach(c => c.destroy());

        // Reset speeds back to normal
        if (this.isMultiplayer) {
            if (this.scene.frontendPlayers[window.socket.id])
                this.scene.frontendPlayers[window.socket.id].speed = 250;
        } else if (this.scene.player) this.scene.player.speed = this.scene.player.baseSpeed || 250;
        this.scene.enemies.children.iterate(enemy => {
            if (enemy.chaseSpeed && enemy.baseChaseSpeed) enemy.chaseSpeed = enemy.baseChaseSpeed;
            if (enemy.wanderSpeed && enemy.baseWanderSpeed) enemy.wanderSpeed = enemy.baseWanderSpeed;
            if (enemy.detectionRadius && enemy.baseDetectionRadius) enemy.detectionRadius = enemy.baseDetectionRadius;
        });
    }

    showWeatherChangeText() {
        const cam = this.scene.cameras.main;
        const text = this.scene.add.text(cam.width - 50, 80, "Changing Weather...", {
            fontSize: "20px",
            fill: "#ffffff",
            backgroundColor: "#000000aa",
            padding: { left: 10, right: 10, top: 5, bottom: 5 }
        })
            .setOrigin(1, 0)
            .setScrollFactor(0)
            .setDepth(999);

        // Fade out after 2 seconds
        this.scene.tweens.add({
            targets: text,
            alpha: 0,
            duration: 2000,
            onComplete: () => text.destroy()
        });
    }


    getWeatherDescription(code) {
        if (code >= 0 && code <= 2) return "☀️ Clear Skies";
        if (code >= 3 && code <= 9) return "☁️ Overcast";
        if (code >= 40 && code <= 49) return "🌫️ Foggy";
        if (code >= 51 && code <= 67) return "🌧️ Rainy";
        if (code >= 71 && code <= 77) return "❄️ Snowy";
        if (code === 80 || (code >= 95 && code <= 99)) return "🌩️ Thunderstorm";
        return "❓ Unstable Weather";
    }

    getGameplayEffectText(code) {
        if (code >= 0 && code <= 2) return "☀️ Enemies are quicker in clear weather!";
        if (code >= 3 && code <= 9) return "☁️ Cloudy skies reduce visibility.";
        if (code >= 40 && code <= 49) return "🌫️ Fog lowers enemy detection range.";
        if (code >= 51 && code <= 67) return "🌧️ Rain makes you slip unpredictably!";
        if (code >= 71 && code <= 77) return "❄️ Snow slows everyone down.";
        if (code === 80 || (code >= 95 && code <= 99)) return "⚡ Lightning strikes at random!";
        return "❓ Unknown effect";
    }



    showGameplayEffectText(description, effectText) {
        const cam = this.scene.cameras.main;
        const text = this.scene.add.text(cam.width - 80, 80, `${effectText}`, {
            fontSize: "18px",
            fill: "#ffffff",
            backgroundColor: "#000000aa",
            padding: { left: 10, right: 10, top: 5, bottom: 5 }
        })
            .setOrigin(1, 0)
            .setScrollFactor(0)
            .setDepth(999);

        this.scene.tweens.add({
            targets: text,
            alpha: 0,
            duration: 2000,
            delay: 3000, // stays visible for 3 seconds
            onComplete: () => text.destroy()
        });
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
        // Adjust speed of YOUR player
        const player = this.scene.player || this.scene.frontendPlayers?.[window.socket?.id];
        if (player) {
            player.speed = (player.speed || 150) * factor;
        }

        // Adjust other players (multiplayer)
        if (this.scene.frontendPlayers) {
            Object.values(this.scene.frontendPlayers).forEach(p => {
                if (p && p !== player) {
                    p.speed = (p.speed || 150) * factor;
                }
            });
        }

        // Enemies
        this.scene.enemies.children.iterate(enemy => {
            enemy.chaseSpeed *= factor;
            enemy.wanderSpeed *= factor;
        });
    }


    addCloudOverlay() {
        const mapWidth = this.scene.map.widthInPixels;
        const mapHeight = this.scene.map.heightInPixels;

        const staticCloudKeys = ['cloud1', 'cloud2', 'cloud3', 'cloud4', 'cloud5'];
        const spacing = 130;

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
        this.slippingEvent = this.scene.time.addEvent({
            delay: 5000,
            loop: true,
            callback: () => {
                const player = this.scene.player || this.scene.frontendPlayers?.[window.socket?.id];

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
        this.lightningStrikeEvent = this.scene.time.addEvent({
            delay: 3000,
            loop: true,
            callback: () => this.strikeLightning()
        });
    }

    strikeLightning() {
        const x = Phaser.Math.Between(0, this.scene.map.widthInPixels);
        const y = Phaser.Math.Between(0, this.scene.map.heightInPixels);

        // Always show lightning visuals
        this.showLightningVisual(x, y);

        if (!this.isMultiplayer) {
            this.applyLightningDamage(x, y);
        } else {
            // 🔥 Multiplayer: tell the server to check damage
            this.scene.socket.emit("lightningStrikeRequest", { x, y });
        }
    }

    showLightningVisual(x, y) {
        this.scene.sound.play('thunder', { volume: 0.3 });
        const lightning = this.scene.add.image(x, y, 'lightning')
            .setDepth(1000)
            .setScale(2)
            .setOrigin(0.5)
            .setAlpha(0);

        this.scene.tweens.add({
            targets: lightning,
            alpha: 1,
            duration: 100,
            ease: 'Cubic.easeIn',
            onComplete: () => {
                this.scene.tweens.add({
                    targets: lightning,
                    alpha: 0,
                    duration: 200,
                    ease: 'Cubic.easeOut',
                    onComplete: () => lightning.destroy()
                });
            }
        });

        this.scene.cameras.main.shake(250, 0.01);
    }

    applyLightningDamage(x, y) {
        const radius = 50;
        const player = this.scene.player;
        if (player && player.active) {
            const dist = Phaser.Math.Distance.Between(x, y, player.x, player.y);
            if (dist < radius && !player.invulnerable) {
                player.hp--;
                player.setTint(0xff0000);
                this.scene.time.delayedCall(100, () => player.clearTint());
            }
        }

        this.scene.enemies.children.iterate(enemy => {
            if (!enemy.active) return;
            if (Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) < radius) {
                enemy.takeDamage?.(2);
            }
        });
    }




}
