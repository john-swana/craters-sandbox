import { EntityComponentSystem as ECS } from "craters";

export class Player extends ECS.Component {
    grounded: boolean;
    groundedFrames: number;   // coyote time counter (counts down from COYOTE_FRAMES)
    jumpPower: number;
    speed: number;
    jumpBufferFrames: number; // jump-buffer counter: stays > 0 for N frames after JUMP pressed
    isJumpHeld: boolean;      // true while jump button held (for variable jump height)

    constructor() {
        super();
        this.grounded = false;
        this.groundedFrames = 0;
        this.jumpPower = 12;
        this.speed = 5;
        this.jumpBufferFrames = 0;
        this.isJumpHeld = false;
    }
}
