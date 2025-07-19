import Phaser from "phaser";

export default class MysteryCrystal extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'crystal');

        scene.add.existing(this);
        scene.physics.add.existing(this);

        scene.tweens.add({
            targets: this,
            y: this.y - 8, // move up by 8 pixels
            duration: 1000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });

        // Optional: slight rotation for extra life
        scene.tweens.add({
            targets: this,
            angle: { from: -5, to: 5 },
            duration: 1500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
        this.setScale(0.10);

        this.setDepth(200);


        this.scene = scene;

        this.overlay = scene.add.text(x, y, "?", {
            fontSize: "24px",
            fontFamily: "Arial",
            color: "#ffffff",
            stroke: "#000000",
            strokeThickness: 4
        }).setOrigin(0.5).setDepth(201);

        this.updateOverlay = () => this.overlay.setPosition(this.x, this.y);
        this.on('destroy', () => this.overlay.destroy());
    }

    preUpdate(time, delta) {
        super.preUpdate(time, delta);
        this.updateOverlay();
    }


}
