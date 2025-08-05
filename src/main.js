import { Arena1 } from "./Arena1.js";
import { StartScene } from "./StartScene.js";
import { PauseScene } from "./PauseScene.js";
import { LoadingScene } from "./LoadingScreen.js";
import { Arena1_New_Multi } from "./Classes/MultiplayerMap.js";
import { Arena1_New } from "./Classes/SinglePlayerMap.js";
import { LobbyScene } from './LobbyScene.js';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 480,
  backgroundColor: "#1a1a1a",
  parent: "game-container",
  scene: [StartScene, Arena1_New, Arena1_New_Multi, PauseScene, LoadingScene, LobbyScene],
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
  },
  input: {
    autoPause: false
  },
  autoFocus: true,
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

game.events.off('hidden', game.loop.sleep, game.loop); // Remove the listener that pauses
game.events.off('visible', game.loop.wake, game.loop); // Remove the listener that resumes

document.addEventListener('visibilitychange', function () {
  if (document.visibilityState === 'hidden') {
    // Do NOTHING, so the game stays alive!
  }
});
// Prevent the game from pausing when the window loses focus
window.addEventListener('blur', (event) => {
  event.preventDefault();
  // Do NOTHING, so the game stays alive!
});