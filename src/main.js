import { SceneMain } from "./Arena1.js";


const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 480,
  backgroundColor: "#1a1a1a",
  parent: "game-container",
  scene: [SceneMain],
  pixelArt: true,
  physics: {
    default: "arcade",
    arcade: {
      gravity: { y: 0 },
      debug: false
    }
  }
};



new Phaser.Game(config);
