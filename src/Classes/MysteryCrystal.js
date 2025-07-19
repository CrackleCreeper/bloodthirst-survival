import Phaser from "phaser";

export default class MysteryCrystal extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'mystery_crystal');

        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setScale(0.15);
        this.body.setSize(200, 200, true);
        this.body.setOffset(15, 10); // Adjust the offset to center the sprite
        this.play('crystal_spin');
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
