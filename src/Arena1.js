import { Map } from "./Classes/Map"; // path to your base Map class

export class Arena1 extends Map {
    constructor() {
        super({
            key: "Arena1",
            mapKey: "Arena1_New",
            tilesets: [
                { name: "Grass", imageKey: "tileset", imagePath: "assets/Texture/TX Tileset Grass.png" },
                { name: "Wall", imageKey: "objects", imagePath: "assets/Texture/TX Tileset Wall.png" },
                { name: "Structure", imageKey: "structure", imagePath: "assets/Texture/TX Struct.png" },
                { name: "Plants", imageKey: "plants", imagePath: "assets/Texture/Extra/TX Plant with Shadow.png" },
                { name: "Props", imageKey: "props", imagePath: "assets/Texture/Extra/TX Props with Shadow.png" },
                { name: "Concrete", imageKey: "concrete", imagePath: "assets/Texture/TX Tileset Stone Ground.png" }
            ]
        });

    }

    preload() {
        // Load tilemap and tile images
        this.load.tilemapTiledJSON("Arena1_New", "assets/Arena1_New.json");

        this.load.image("tileset", "assets/Texture/TX Tileset Grass.png");
        this.load.image("objects", "assets/Texture/TX Tileset Wall.png");
        this.load.image("structure", "assets/Texture/TX Struct.png");
        this.load.image("plants", "assets/Texture/Extra/TX Plant with Shadow.png");
        this.load.image("props", "assets/Texture/Extra/TX Props with Shadow.png");
        this.load.image("concrete", "assets/Texture/TX Tileset Stone Ground.png");

        // Load all animation spritesheets (optional: move to base class if reused)
        this.input.keyboard.on("keydown-ENTER", () => {
            document.getElementById("overlay").style.display = "none";
            document.getElementById("game-container").style.display = "block";
            console.log("Game Starting...");
        });
        this.loadAnimationSpriteSheets();
    }

    create() {
        // // ✅ SET map FIRST before calling super.create()
        // this.map = this.make.tilemap({ key: "map" });

        // // 👇 Optionally: assign tilesets before calling super
        // this.tilesets = [
        //     this.map.addTilesetImage("Grass", "tileset"),
        //     this.map.addTilesetImage("Wall", "objects"),
        //     this.map.addTilesetImage("Structure", "structure"),
        //     this.map.addTilesetImage("Plants", "plants"),
        //     this.map.addTilesetImage("Props", "props"),
        //     this.map.addTilesetImage("Concrete", "concrete")
        // ];

        // ✅ Call base create after setting required data
        super.create();
    }
}
