import Phaser from "phaser";
export default class BloodCrystal extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, shardType = 'Vampire1') {
        super(scene, x, y, 'blood_crystal');

        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setScale(0.15);
        this.play('crystal_spin');
        this.setDepth(200);

        this.shardType = shardType;

        const tintMap = {
            Vampire1: 0x990000,  // Dark Red - HP restore
            Vampire2: 0xff5500,  // Crimson/Orange - Speed boost
            Vampire3: 0xff2222   // Bright Red - Attack buff or AoE blast
        };

        const tintColor = tintMap[shardType] || 0xffffff;
        this.setTint(tintColor);
    }
}
