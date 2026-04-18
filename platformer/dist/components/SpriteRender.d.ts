import { EntityComponentSystem as ECS } from "craters";
export declare class SpriteRender extends ECS.Component {
    image: HTMLImageElement;
    frameWidth: number;
    frameHeight: number;
    offsetX: number;
    offsetY: number;
    animations: any;
    currentAnim: string | null;
    frameIndex: number;
    timer: number;
    flipX: boolean;
    constructor(image: HTMLImageElement, frameWidth: number, frameHeight: number, offsetX?: number, offsetY?: number);
    addAnim(name: string, speed: number, frames: number[], loop?: boolean): void;
    play(name: string): void;
}
