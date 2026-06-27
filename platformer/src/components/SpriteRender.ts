import { EntityComponentSystem as ECS } from "craters";

/** A single named frame from a texture atlas (non-uniform grid). */
export interface AtlasFrame {
    x: number;
    y: number;
    w: number;
    h: number;
}

export class SpriteRender extends ECS.Component {
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

    constructor(image: HTMLImageElement, frameWidth: number, frameHeight: number, offsetX = 0, offsetY = 0, scale = 1) {
        super();
        this.image = image;
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.scale = scale;
        this.animations = {};
        this.currentAnim = null;
        this.frameIndex = 0;
        this.timer = 0;
        this.flipX = false;
        this.atlasFrames = null;
    }

    addAnim(name: string, speed: number, frames: number[], loop = true) {
        this.animations[name] = { speed, frames, loop };
        if (!this.currentAnim) {
            this.play(name);
        }
    }

    play(name: string) {
        if (this.currentAnim !== name) {
            this.currentAnim = name;
            this.frameIndex = 0;
            this.timer = 0;
        }
    }
}
