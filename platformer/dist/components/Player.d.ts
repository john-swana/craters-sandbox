import { EntityComponentSystem as ECS } from "craters";
export declare class Player extends ECS.Component {
    grounded: boolean;
    groundedFrames: number;
    jumpPower: number;
    speed: number;
    jumpBufferFrames: number;
    isJumpHeld: boolean;
    hurtFrames: number;
    lives: number;
    maxLives: number;
    hasDoubleJumped: boolean;
    dashCooldown: number;
    dashTime: number;
    dashDirection: number;
    sx: number;
    sy: number;
    landSquash: number;
    star: number;
    shootCD: number;
    hp: number;
    maxHp: number;
    constructor();
}
