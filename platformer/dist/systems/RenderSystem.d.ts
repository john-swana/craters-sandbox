import { EntityComponentSystem as ECS } from "craters";
export declare class RenderSystem extends ECS.System {
    renderer: any;
    private tilesImage;
    cameraX: number;
    cameraY: number;
    private query;
    constructor(renderer: any, tilesImage?: HTMLImageElement);
    initialize(): void;
    execute(_delta: number): void;
}
