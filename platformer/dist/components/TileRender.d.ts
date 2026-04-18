import { EntityComponentSystem as ECS } from "craters";
export declare class TileRender extends ECS.Component {
    srcX: number;
    srcY: number;
    image: HTMLImageElement;
    width: number;
    height: number;
    constructor(srcX: number, srcY: number, image: HTMLImageElement, width?: number, height?: number);
}
