import { EntityComponentSystem as ECS } from "craters";

export class Player extends ECS.Component {
    grounded: boolean;
    groundedFrames: number;   // coyote time counter (counts down from COYOTE_FRAMES)
    jumpPower: number;
    speed: number;
    jumpBufferFrames: number; // jump-buffer counter: stays > 0 for N frames after JUMP pressed
    isJumpHeld: boolean;      // true while jump button held (for variable jump height)
    hurtFrames: number;       // invincibility countdown after taking damage (frames)
    
    // Remastered gameplay properties
    lives: number;
    maxLives: number;
    hasDoubleJumped: boolean;
    dashCooldown: number;     // frames until next dash can be triggered (cooldown = 60 frames)
    dashTime: number;         // frames of active dash remaining (active = 10 frames)
    dashDirection: number;    // -1 = Left, 1 = Right

    // Visual squash-and-stretch (reference port)
    sx: number;               // current x scale (approaches target smoothly)
    sy: number;               // current y scale
    landSquash: number;       // 0-1 squash magnitude applied on landing

    // Star power (invincibility item)
    star: number;             // frames remaining; 0 = off
    shootCD: number;          // frames until next spark shot is allowed

    // HP heart system
    hp: number;
    maxHp: number;

    constructor() {
        super();
        this.grounded = false;
        this.groundedFrames = 0;
        this.jumpPower = 12;
        this.speed = 5;
        this.jumpBufferFrames = 0;
        this.isJumpHeld = false;
        this.hurtFrames = 0;
        
        // Initializing remastered properties
        this.lives = 3;
        this.maxLives = 3;
        this.hasDoubleJumped = false;
        this.dashCooldown = 0;
        this.dashTime = 0;
        this.dashDirection = 1;

        // Squash-stretch
        this.sx = 1;
        this.sy = 1;
        this.landSquash = 0;

        // Star / shoot
        this.star = 0;
        this.shootCD = 0;

        // HP
        this.hp = 3;
        this.maxHp = 3;
    }
}
