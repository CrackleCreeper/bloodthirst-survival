import { Arena1 } from "./Arena1.js";
import { StartScene } from "./StartScene.js";

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 480,
  backgroundColor: "#1a1a1a",
  parent: "game-container",
  scene: [StartScene, Arena1,],
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



const game = new Phaser.Game(config);
game.scene.start("StartScene");