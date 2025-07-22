import { Arena1 } from "./Arena1.js";
import { StartScene } from "./StartScene.js";
import { PauseScene } from "./PauseScene.js";
import { LoadingScene } from "./LoadingScreen.js";

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 480,
  backgroundColor: "#1a1a1a",
  parent: "game-container",
  scene: [StartScene, Arena1, PauseScene, LoadingScene],
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

// Handle Enter key to hide overlay and show game
window.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    document.getElementById("overlay").style.display = "none";
    document.getElementById("game-container").style.display = "block";
    // Optional: Start Arena1 directly if you skip StartScene
    // game.scene.start("Arena1");
  }
});