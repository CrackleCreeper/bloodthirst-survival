import { Map } from './Map.js';

export class Arena1_New extends Map {
    constructor() {
        super({
            key: 'Arena1_New',
            mapKey: 'Arena1_New',
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

    create() {
        super.create().then(() => {
            this.setupSingleplayer();
        });
    }
}
