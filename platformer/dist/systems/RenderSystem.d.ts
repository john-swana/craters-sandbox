import { EntityComponentSystem as ECS } from "craters";
export declare class RenderSystem extends ECS.System {
    renderer: any;
    cameraX: number;
    cameraY: number;
    constructor(renderer: any);
    execute(delta: number): void;
}
