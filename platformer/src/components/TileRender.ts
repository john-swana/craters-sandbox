import { EntityComponentSystem as ECS } from "craters";

export class TileRender extends ECS.Component {
    srcX: number;
    srcY: number;
    image: HTMLImageElement;
    width: number;   // destination size (the level grid cell)
    height: number;
    srcW: number;    // source size in the atlas (may differ, e.g. Kenney 64px tiles → 70px grid)
    srcH: number;
    constructor(srcX: number, srcY: number, image: HTMLImageElement, width: number = 70, height: number = 70, srcW: number = width, srcH: number = height) {
        super();
        this.srcX = srcX;
        this.srcY = srcY;
        this.image = image;
        this.width = width;
        this.height = height;
        this.srcW = srcW;
        this.srcH = srcH;
    }
}
