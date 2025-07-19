export default class BloodCrystal extends Phaser.Physics.Arcade.Sprite {
    constructor(scene, x, y, shardType = 'Vampire1') {
        super(scene, x, y, 'crystal'); // Use 'crystal' for the static image
        scene.add.existing(this);
        scene.physics.add.existing(this);
        // Set visual/collection properties
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

        this.shardType = shardType;
        const tintMap = {
            Vampire1: 0x990000,
            Vampire2: 0xff5500,
            Vampire3: 0xff2222
        };
        const tintColor = tintMap[shardType] || 0xffffff;
        this.setTint(tintColor);
    }
}
