import Phaser from "phaser";

export default class BloodCrystal extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y) {
        super(scene, x, y, 'blood_crystal');
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setScale(0.15);
        this.play('crystal_spin');
        this.setDepth(200)
        this.setTint(0xff00ff);
    }
}
