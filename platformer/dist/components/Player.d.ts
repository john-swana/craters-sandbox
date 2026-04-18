import { EntityComponentSystem as ECS } from "craters";
export declare class Player extends ECS.Component {
    grounded: boolean;
    groundedFrames: number;
    jumpPower: number;
    speed: number;
    jumpBufferFrames: number;
    isJumpHeld: boolean;
    constructor();
}
