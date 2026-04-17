import { EntityComponentSystem as ECS } from "craters";

export class TileRender extends ECS.Component {
    srcX: number;
    srcY: number;
    image: HTMLImageElement;
    width: number;
    height: number;
    constructor(srcX: number, srcY: number, image: HTMLImageElement, width: number = 70, height: number = 70) {
        super();
        this.srcX = srcX;
        this.srcY = srcY;
        this.image = image;
        this.width = width;
        this.height = height;
    }
}
