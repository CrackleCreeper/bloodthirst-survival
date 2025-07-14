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
        this.activeCode = code;
        console.log("Applying weather effect for code:", code);
        if (code === 0) {
            this.buffEnemySpeed(1.3);
        } else if (code >= 1 && code <= 3) {
            this.vignette = this.addVignetteOverlay();
        } else if (code >= 45 && code <= 48) {
            this.addFogOverlay();
            this.reduceEnemySight(0.5);
        } else if (code >= 51 && code <= 67) {
            this.enablePlayerSlips();
        } else if (code >= 71 && code <= 77) {
            this.slowEveryone(0.6);
        } else if (code >= 95 && code <= 99) {
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

    addVignetteOverlay() {
        const cam = this.scene.cameras.main;

        this.vignette = this.scene.add.image(0, 0, 'vignette')
            .setOrigin(0)
            .setScrollFactor(0)
            .setDepth(200)
            .setAlpha(1)
            .setDisplaySize(cam.width, cam.height);


        // Optional: resize to cover the whole screen
        this.scene.events.on('update', () => {
            if (this.vignette) {
                const cam = this.scene.cameras.main;
                this.vignette.setDisplaySize(cam.width / cam.zoom, cam.height / cam.zoom);
            }
        });



    }






    addFogOverlay() {
        const cam = this.scene.cameras.main;
        const fog = this.scene.add.rectangle(
            cam.scrollX,
            cam.scrollY,
            cam.width,
            cam.height,
            0xCCCCCC,
            0.4
        )
            .setOrigin(0)
            .setScrollFactor(0) // screen space
            .setDepth(998);

        this.scene.fogOverlay = fog;

        this.scene.events.on('update', () => {
            fog.x = cam.scrollX;
            fog.y = cam.scrollY;
        });
    }


    enablePlayerSlips() {
        this.scene.time.addEvent({
            delay: 5000,
            loop: true,
            callback: () => {
                if (!this.scene.player.active) return;
                const slip = new Phaser.Math.Vector2(Phaser.Math.Between(-100, 100), Phaser.Math.Between(-100, 100));
                this.scene.player.body.velocity.add(slip);
                this.scene.cameras.main.shake(200, 0.005);
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

        const flash = this.scene.add.rectangle(x, y, 40, 40, 0xFFFFFF)
            .setDepth(1000)
            .setAlpha(1);

        this.scene.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 200,
            onComplete: () => flash.destroy()
        });

        // Damage any entity in blast radius
        const radius = 50;
        const hitPlayer = Phaser.Math.Distance.Between(x, y, this.scene.player.x, this.scene.player.y) < radius;
        if (hitPlayer && !this.scene.player.invulnerable) {
            this.scene.player.hp--;
            this.scene.player.setTint(0xff0000);
            this.scene.time.delayedCall(100, () => this.scene.player.clearTint());
        }

        this.scene.enemies.children.iterate(enemy => {
            if (!enemy.active) return;
            const hit = Phaser.Math.Distance.Between(x, y, enemy.x, enemy.y) < radius;
            if (hit) enemy.takeDamage(2);
        });
    }
}
