import { EntityComponentSystem as ECS } from "craters";
import { Enemy } from "../components/Enemy";
import { Position } from "../components/Position";
import { BoxCollider } from "../components/BoxCollider";
import { SpriteRender } from "../components/SpriteRender";
import { Platform } from "../components/Platform";

// How many ticks the corpse sprite shows before the entity is removed
const DEAD_LINGER_FRAMES = 25;
// Bee oscillation speed (radians per tick)
const BEE_FLOAT_SPEED = 0.06;
// Inset applied to the bee/spider AABB before obstacle testing.
// Prevents corner-grazes from triggering a reversal.
const OBSTACLE_INSET = 8;
// Frames of immunity after a reversal to prevent oscillation
const REVERSE_COOLDOWN = 22;

/** AABB overlap test on INSET rects to ignore corner grazes. */
function aabbOverlapInset(
    ax: number, ay: number, aw: number, ah: number,
    bx: number, by: number, bw: number, bh: number,
    inset: number
): boolean {
    const ix = ax + inset, iy = ay + inset,
          iw = aw - inset * 2, ih = ah - inset * 2;
    if (iw <= 0 || ih <= 0) return false;
    return ix < bx + bw && ix + iw > bx
        && iy < by + bh && iy + ih > by;
}

export class EnemySystem extends ECS.System {
    // Cached queries — created once in initialize(), reused every frame.
    private enemyQuery!: ECS.Query;
    private solidQuery!: ECS.Query;

    initialize(): void {
        this.enemyQuery = this.world!.createQuery([Position, Enemy]);
        this.solidQuery = this.world!.createQuery([Position, BoxCollider]);
    }

    execute(_delta: number): void {
        // Build solid-obstacle list once per frame (platforms + crates)
        const solidRects: { x: number; y: number; w: number; h: number }[] = [];
        for (const s of this.solidQuery.entities) {
            if (!s.getComponent(Platform)) continue;
            const sp = s.getComponent(Position);
            const sc = s.getComponent(BoxCollider);
            solidRects.push({ x: sp.x, y: sp.y, w: sc.width, h: sc.height });
        }

        for (const entity of this.enemyQuery.entities) {
            const pos    = entity.getComponent(Position);
            const enemy  = entity.getComponent(Enemy);
            const sprite = entity.getComponent(SpriteRender);

            // ── Dead state ────────────────────────────────────────────────────
            if (enemy.dead) {
                if (sprite) sprite.play('dead');
                enemy.deadFrames++;
                if (enemy.deadFrames >= DEAD_LINGER_FRAMES) {
                    this.world!.removeEntity(entity);
                }
                continue;
            }

            // ── Spider: patrol with crate/platform blocking ───────────────────
            if (enemy.type === 'spider') {
                const col = entity.getComponent(BoxCollider);
                const sw  = col ? col.width  : 60;
                const sh  = col ? col.height : 40;
                const nextX = pos.x + enemy.speed * enemy.direction;

                let blockedSpider = false;
                if (enemy.reverseCooldown > 0) {
                    enemy.reverseCooldown--;
                } else {
                    for (const sr of solidRects) {
                        if (aabbOverlapInset(nextX, pos.y, sw, sh, sr.x, sr.y, sr.w, sr.h, OBSTACLE_INSET)) {
                            blockedSpider = true;
                            break;
                        }
                    }
                }

                if (blockedSpider) {
                    enemy.direction      *= -1;
                    enemy.reverseCooldown = REVERSE_COOLDOWN;
                } else {
                    pos.x = nextX;
                }

                if (pos.x <= enemy.patrolLeft) {
                    pos.x = enemy.patrolLeft;
                    enemy.direction = 1;
                } else if (pos.x >= enemy.patrolRight) {
                    pos.x = enemy.patrolRight;
                    enemy.direction = -1;
                }

                if (sprite) {
                    sprite.flipX = enemy.direction > 0;
                    sprite.play('walk');
                }
            }

            // ── Bee: patrol + sinusoidal float with obstacle avoidance ────────
            if (enemy.type === 'bee') {
                if (enemy.baseY === 0) enemy.baseY = pos.y;

                const col = entity.getComponent(BoxCollider);
                const bw  = col ? col.width  : 50;
                const bh  = col ? col.height : 40;

                const nextX = pos.x + enemy.speed * enemy.direction;

                enemy.floatPhase += BEE_FLOAT_SPEED;
                const nextY = enemy.baseY + Math.sin(enemy.floatPhase) * enemy.floatAmp;

                let blocked = false;
                if (enemy.reverseCooldown > 0) {
                    enemy.reverseCooldown--;
                } else {
                    for (const sr of solidRects) {
                        if (aabbOverlapInset(nextX, nextY, bw, bh, sr.x, sr.y, sr.w, sr.h, OBSTACLE_INSET)) {
                            blocked = true;
                            break;
                        }
                    }
                }

                if (blocked) {
                    enemy.direction      *= -1;
                    enemy.reverseCooldown = REVERSE_COOLDOWN;
                } else {
                    pos.x = nextX;
                }
                pos.y = nextY;

                if (pos.x <= enemy.patrolLeft) {
                    pos.x = enemy.patrolLeft;
                    enemy.direction = 1;
                } else if (pos.x >= enemy.patrolRight) {
                    pos.x = enemy.patrolRight;
                    enemy.direction = -1;
                }

                if (sprite) {
                    sprite.flipX = enemy.direction > 0;
                    sprite.play(Math.sin(enemy.floatPhase * 2) > 0 ? 'fly' : 'flyAlt');
                }
            }
        }
    }
}
