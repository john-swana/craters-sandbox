import { EntityComponentSystem as ECS } from "craters";
import { Velocity } from "../components/Velocity";
import { Player } from "../components/Player";
import { SpriteRender } from "../components/SpriteRender";
import { RigidBody } from "../components/RigidBody";

// ── Platformer feel constants ───────────────────────────────────────────────
// Coyote time: frames the player can still jump after walking off a ledge.
// ~133ms at 60fps — wide enough to feel fair, tight enough to not be cheating.
const COYOTE_FRAMES = 8;

// Jump buffer: frames a jump input is "remembered" before landing.
// Press jump slightly before you land → still jumps. ~100ms at 60fps.
const JUMP_BUFFER_FRAMES = 6;

// Variable jump: when jump is released early, upward velocity is multiplied
// by this factor to produce a short hop. 0.4 = cut to 40% = clean short arc.
const JUMP_CUT_FACTOR = 0.4;

export class InputSystem extends ECS.System {
    input: any;
    sounds: any;

    constructor(input: any, sounds: any) {
        super();
        this.input = input;
        this.sounds = sounds;
    }

    execute(delta: number) {
        const query = this.world.createQuery([Velocity, Player]);

        query.entities.forEach((entity: any) => {
            const vel      = entity.getComponent(Velocity);
            const player   = entity.getComponent(Player);
            const rigidBody = entity.getComponent(RigidBody);
            const sprite   = entity.getComponent(SpriteRender);

            // ── Horizontal movement ─────────────────────────────────────────────
            vel.x = 0;
            if (this.input.isPressed("MOVE_LEFT")) {
                vel.x = -player.speed;
                if (sprite) sprite.flipX = true;
                if (rigidBody?.body) rigidBody.body.wake();
            }
            if (this.input.isPressed("MOVE_RIGHT")) {
                vel.x = player.speed;
                if (sprite) sprite.flipX = false;
                if (rigidBody?.body) rigidBody.body.wake();
            }

            // ── Jump buffer ─────────────────────────────────────────────────────
            // Record intent for JUMP_BUFFER_FRAMES so a slightly-early press still fires.
            const jumpJustPressed = this.input.isPressed("JUMP") === 2;
            const jumpHeld        = this.input.isPressed("JUMP") >= 1;

            if (jumpJustPressed) {
                player.jumpBufferFrames = JUMP_BUFFER_FRAMES;
            } else if (player.jumpBufferFrames > 0) {
                player.jumpBufferFrames--;
            }

            // ── Jump trigger (coyote time built into groundedFrames) ────────────
            // Fire if: jump buffer active AND (grounded OR within coyote window)
            const canJump = player.grounded || player.groundedFrames > 0;
            if (player.jumpBufferFrames > 0 && canJump) {
                vel.y = -player.jumpPower;
                player.grounded = false;
                player.groundedFrames = 0;  // consume coyote time
                player.jumpBufferFrames = 0; // consume buffer
                player.isJumpHeld = true;
                if (this.sounds.jump) this.sounds.jump.play();
                if (rigidBody?.body) {
                    rigidBody.body.velocity.y = vel.y;
                    rigidBody.body.wake();
                }
            }

            // ── Variable jump height ────────────────────────────────────────────
            // Release jump early while still rising → cut upward velocity.
            if (player.isJumpHeld) {
                if (!jumpHeld && vel.y < 0) {
                    // Jump released while rising — clamp to short hop
                    vel.y *= JUMP_CUT_FACTOR;
                    if (rigidBody?.body) rigidBody.body.velocity.y = vel.y;
                    player.isJumpHeld = false;
                } else if (vel.y >= 0) {
                    // Reached apex — no longer "held"
                    player.isJumpHeld = false;
                }
            }

            // ── Animation state ─────────────────────────────────────────────────
            if (sprite) {
                if (player.grounded) {
                    sprite.play(vel.x !== 0 ? 'run' : 'idle');
                } else {
                    sprite.play(vel.y < 0 ? 'jump' : 'fall');
                }
            }
        });
    }
}
