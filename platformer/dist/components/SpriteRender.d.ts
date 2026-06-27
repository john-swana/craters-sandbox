import { EntityComponentSystem as ECS } from "craters";
/** A single named frame from a texture atlas (non-uniform grid). */
export interface AtlasFrame {
    x: number;
    y: number;
    w: number;
    h: number;
}
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
    /** When set, frame indices refer to this array instead of a uniform grid. */
    atlasFrames: AtlasFrame[] | null;
    /** Render scale applied to the destination size (source frame is unscaled).
     *  Lets large atlas frames (e.g. Kenney's 128px characters) draw at game size. */
    scale: number;
    constructor(image: HTMLImageElement, frameWidth: number, frameHeight: number, offsetX?: number, offsetY?: number, scale?: number);
    addAnim(name: string, speed: number, frames: number[], loop?: boolean): void;
    play(name: string): void;
}
