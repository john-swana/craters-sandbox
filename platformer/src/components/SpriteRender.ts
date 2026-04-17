import { EntityComponentSystem as ECS } from "craters";

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

    constructor(image: HTMLImageElement, frameWidth: number, frameHeight: number, offsetX = 0, offsetY = 0) {
        super();
        this.image = image;
        this.frameWidth = frameWidth;
        this.frameHeight = frameHeight;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.animations = {};
        this.currentAnim = null;
        this.frameIndex = 0;
        this.timer = 0;
        this.flipX = false;
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
