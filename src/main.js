import { SceneMain } from "./Arena1.js";


const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 480,
  backgroundColor: "#1a1a1a",
  parent: "game-container",
  scene: [SceneMain],
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 960,
    height: 540
  },
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  }
};



new Phaser.Game(config);
