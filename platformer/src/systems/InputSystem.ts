import { EntityComponentSystem as ECS } from "craters";
import { Position } from "../components/Position";
import { BoxCollider } from "../components/BoxCollider";
import { Velocity } from "../components/Velocity";
import { Player } from "../components/Player";
import { SpriteRender } from "../components/SpriteRender";
import { RigidBody } from "../components/RigidBody";
import { ParticleSystem } from "./ParticleSystem";
import { Projectile } from "../components/Projectile";

// ── Platformer feel constants ───────────────────────────────────────────────
const COYOTE_FRAMES      = 8;
const JUMP_BUFFER_FRAMES = 6;
const JUMP_CUT_FACTOR    = 0.4;
const PROJ_SPEED         = 9;
const PROJ_COOLDOWN      = 18; // frames between shots

export class InputSystem extends ECS.System {
    input: any;
    sounds: any;
    particles: ParticleSystem | null = null;
    private runPuffTimer: number = 0;

    private playSound(sound: any) {
        if (sound && !(window as any).gameInstance?.muted) {
            sound.play();
        }
    }

    // Cached queries — created once in initialize(), reused every frame.
    private playerQuery!: ECS.Query;
    private projQuery!: ECS.Query;

    constructor(input: any, sounds: any, particles?: ParticleSystem) {
        super();
        this.input = input;
        this.sounds = sounds;
        this.particles = particles ?? null;
    }

    initialize(): void {
        this.playerQuery = this.world!.createQuery([Velocity, Player]);
        this.projQuery   = this.world!.createQuery([Projectile, Position, Velocity]);
    }

    execute(delta: number) {
        this.runPuffTimer++;

        this.playerQuery.entities.forEach((entity: any) => {
            const vel       = entity.getComponent(Velocity);
            const player    = entity.getComponent(Player);
            const rigidBody = entity.getComponent(RigidBody);
            const sprite    = entity.getComponent(SpriteRender);
            const pos       = entity.getComponent(Position);
            const col       = entity.getComponent(BoxCollider);

            // ── Tick timers ────────────────────────────────────────────────
            if (player.dashCooldown > 0) player.dashCooldown--;
            if (player.dashTime     > 0) player.dashTime--;
            if (player.shootCD      > 0) player.shootCD--;
            if (player.star         > 0) player.star--;

            if (player.grounded) {
                player.hasDoubleJumped = false;
            }

            // Determine dash direction from movement keys
            if (this.input.isPressed("MOVE_LEFT")) {
                player.dashDirection = -1;
            } else if (this.input.isPressed("MOVE_RIGHT")) {
                player.dashDirection = 1;
            } else if (sprite) {
                player.dashDirection = sprite.flipX ? -1 : 1;
            }

            // ── Dash ───────────────────────────────────────────────────────
            const dashJustPressed = this.input.isPressed("DASH") === 2;
            if (dashJustPressed && player.dashCooldown === 0) {
                player.dashTime     = 10;
                player.dashCooldown = 60;
                this.playSound(this.sounds.jump);
                if (this.particles && pos && col) {
                    this.particles.emit('jump_burst', pos.x + col.width * 0.5, pos.y + col.height * 0.5);
                }
            }

            if (player.dashTime > 0) {
                vel.x = player.speed * 2.5 * player.dashDirection;
                vel.y = 0;
                if (rigidBody?.body) {
                    rigidBody.body.velocity.x = vel.x;
                    rigidBody.body.velocity.y = 0;
                    rigidBody.body.wake();
                }
                if (this.particles && pos && col) {
                    const trailX = player.dashDirection > 0 ? pos.x : pos.x + col.width;
                    this.particles.emit('run_puff', trailX, pos.y + col.height * 0.5);
                }
            } else {
                // ── Horizontal movement ────────────────────────────────────
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
            }

            // ── Jump buffer ────────────────────────────────────────────────
            const jumpJustPressed = this.input.isPressed("JUMP") === 2;
            const jumpHeld        = this.input.isPressed("JUMP") >= 1;

            if (jumpJustPressed) {
                player.jumpBufferFrames = JUMP_BUFFER_FRAMES;
            } else if (player.jumpBufferFrames > 0) {
                player.jumpBufferFrames--;
            }

            // ── Jump trigger ───────────────────────────────────────────────
            const canJump = player.grounded || player.groundedFrames > 0;
            if (player.jumpBufferFrames > 0 && player.dashTime <= 0) {
                if (canJump) {
                    vel.y = -player.jumpPower;
                    player.grounded        = false;
                    player.groundedFrames  = 0;
                    player.jumpBufferFrames = 0;
                    player.isJumpHeld      = true;
                    // Squash upward on jump
                    player.sx = 0.82; player.sy = 1.22;
                    this.playSound(this.sounds.jump);
                    if (this.particles && pos && col) {
                        this.particles.emit('jump_burst', pos.x + col.width * 0.5, pos.y + col.height);
                    }
                    if (rigidBody?.body) { rigidBody.body.velocity.y = vel.y; rigidBody.body.wake(); }
                } else if (!player.hasDoubleJumped) {
                    vel.y = -player.jumpPower * 0.95;
                    player.hasDoubleJumped  = true;
                    player.jumpBufferFrames = 0;
                    player.isJumpHeld       = true;
                    player.sx = 0.82; player.sy = 1.22;
                    this.playSound(this.sounds.jumpHigh || this.sounds.jump);
                    if (this.particles && pos && col) {
                        this.particles.emit('coin_collect', pos.x + col.width * 0.5, pos.y + col.height);
                    }
                    if (rigidBody?.body) { rigidBody.body.velocity.y = vel.y; rigidBody.body.wake(); }
                }
            }

            // ── Variable jump height ───────────────────────────────────────
            if (player.isJumpHeld) {
                if (!jumpHeld && vel.y < 0) {
                    vel.y *= JUMP_CUT_FACTOR;
                    if (rigidBody?.body) rigidBody.body.velocity.y = vel.y;
                    player.isJumpHeld = false;
                } else if (vel.y >= 0) {
                    player.isJumpHeld = false;
                }
            }

            // ── Squash-and-stretch ─────────────────────────────────────────
            let tsx = 1, tsy = 1;
            if (!player.grounded) {
                if (vel.y < 0) { tsx = 0.86; tsy = 1.18; }
                else           { tsx = 0.93; tsy = 1.09; }
            } else {
                if (player.landSquash > 0) player.landSquash -= 0.12;
                const sq = Math.max(0, player.landSquash);
                tsy = 1 - sq * 0.22;
                tsx = 1 + sq * 0.22;
            }
            player.sx += (tsx - player.sx) * 0.3;
            player.sy += (tsy - player.sy) * 0.3;

            // ── SHOOT — spark projectile ───────────────────────────────────
            const shootJustPressed = this.input.isPressed("SHOOT") === 2;
            if (shootJustPressed && player.shootCD === 0 && pos && col) {
                player.shootCD = PROJ_COOLDOWN;
                const facing = sprite?.flipX ? -1 : 1;
                const proj = this.world!.createEntity();
                proj.addComponent(new Position(
                    pos.x + col.width  * 0.5 + facing * 14,
                    pos.y + col.height * 0.65
                ));
                proj.addComponent(new Velocity(facing * PROJ_SPEED, 0));
                proj.addComponent(new BoxCollider(12, 12));
                proj.addComponent(new Projectile(facing));
                this.world!.updateEntity(proj);
                this.playSound(this.sounds.shoot);
                if (this.particles) {
                    this.particles.emit('coin_collect',
                        pos.x + col.width  * 0.5 + facing * 14,
                        pos.y + col.height * 0.65
                    );
                }
            }

            // ── Animation state ────────────────────────────────────────────
            if (sprite) {
                if (player.dashTime > 0) {
                    sprite.play('pain');
                } else if (player.grounded) {
                    sprite.play(vel.x !== 0 ? 'run' : 'idle');
                } else {
                    sprite.play(vel.y < 0 ? 'jump' : 'fall');
                }
            }

            // ── Run puff ──────────────────────────────────────────────────
            const RUN_PUFF_INTERVAL = 4;
            if (this.particles && pos && col && player.grounded && vel.x !== 0 && player.dashTime <= 0) {
                if (this.runPuffTimer >= RUN_PUFF_INTERVAL) {
                    this.runPuffTimer = 0;
                    const puffX = vel.x > 0 ? pos.x : pos.x + col.width;
                    this.particles.emit('run_puff', puffX, pos.y + col.height);
                }
            }
        });

        // ── Advance projectile lifetimes & remove dead ones ────────────────
        const toRemove: any[] = [];
        this.projQuery.entities.forEach((entity: any) => {
            const proj = entity.getComponent(Projectile);
            proj.life--;
            proj.spin += 0.45 * proj.dir;

            // Emit trail particles
            if (proj.life % 4 === 0 && this.particles) {
                const pos = entity.getComponent(Position);
                if (pos) {
                    this.particles.emit('run_puff', pos.x + 6, pos.y + 6);
                }
            }

            if (proj.life <= 0) { toRemove.push(entity); }
        });
        toRemove.forEach(e => this.world!.removeEntity(e));
    }
}
