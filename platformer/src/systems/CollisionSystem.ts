import { EntityComponentSystem as ECS, SAT, QuadTree } from "craters";
const { Vector, Box } = SAT;
import { Position } from "../components/Position";
import { Velocity } from "../components/Velocity";
import { BoxCollider } from "../components/BoxCollider";
import { Player } from "../components/Player";
import { Platform } from "../components/Platform";
import { Collectible } from "../components/Collectible";
import { RigidBody } from "../components/RigidBody";
import { Enemy } from "../components/Enemy";
import { ParticleSystem } from "./ParticleSystem";
import { Portal } from "../components/Portal";
import { SpawnPosition } from "../components/SpawnPosition";
import { Projectile } from "../components/Projectile";

// Number of solver iterations per frame.
const SOLVER_ITERATIONS = 4;
const COLLISION_EPSILON = 0.01;

export class CollisionSystem extends ECS.System {
    sounds: any;
    score: number;
    onScoreChange: (score: number) => void;
    particles: ParticleSystem | null = null;

    // ── Cached queries ──────────────────────────────────────────────────────
    // These are created once in initialize() and reused every frame.
    // World.createQuery() registers the query permanently in world.queries;
    // calling it per-frame would leak a new Query object each tick.
    private collidersQuery!: ECS.Query;
    private playerQuery!: ECS.Query;
    private enemyQuery!: ECS.Query;
    private projQuery!: ECS.Query;
    private portalQuery!: ECS.Query;

    constructor(sounds: any, onScoreChange: (score: number) => void, particles?: ParticleSystem) {
        super();
        this.sounds = sounds;
        this.score = 0;
        this.onScoreChange = onScoreChange;
        this.particles = particles ?? null;
    }

    private playSound(sound: any) {
        if (sound && !(window as any).gameInstance?.muted) {
            sound.play();
        }
    }

    initialize(): void {
        this.collidersQuery = this.world!.createQuery([Position, BoxCollider]);
        this.playerQuery    = this.world!.createQuery([Position, Velocity, BoxCollider, Player]);
        this.enemyQuery     = this.world!.createQuery([Position, BoxCollider, Enemy]);
        this.projQuery      = this.world!.createQuery([Projectile, Position, BoxCollider]);
        this.portalQuery    = this.world!.createQuery([Position, BoxCollider, Portal]);
    }

    execute(_delta: number) {
        // ── Broad-phase QuadTree ────────────────────────────────────────────
        const bounds = new Box(new Vector(-10000, -10000), 20000, 20000);
        const qt = new QuadTree.QuadTree(bounds);
        // entity → its quadtree object, for O(1) lookup in the solver loops below
        // (was a linear qtObjects.find per crate/player per frame).
        const qtObjects = new Map<any, any>();

        this.collidersQuery.entities.forEach((entity: any) => {
            const pos = entity.getComponent(Position);
            const col = entity.getComponent(BoxCollider);
            const qtObj = { entity, getAABBAsBox: () => col.getBox(pos) };
            qtObjects.set(entity, qtObj);
            qt.insert(qtObj);
        });

        const groundedThisFrame = new Set<any>();

        // ── Iterative narrow-phase solver: player → platforms ───────────────
        for (let iter = 0; iter < SOLVER_ITERATIONS; iter++) {

            for (const playerEntity of this.playerQuery.entities) {
                const playerPos  = playerEntity.getComponent(Position);
                const playerVel  = playerEntity.getComponent(Velocity);
                const playerCol  = playerEntity.getComponent(BoxCollider);
                const playerBody = playerEntity.getComponent(RigidBody);

                const playerQtObj = qtObjects.get(playerEntity);
                const candidates: any[] = playerQtObj ? qt.retrieveUnique(playerQtObj) : [];

                for (const candidate of candidates) {
                    const other = candidate.entity;
                    if (other === playerEntity) continue;

                    const otherPos  = other.getComponent(Position);
                    const otherCol  = other.getComponent(BoxCollider);
                    const otherBody = other.getComponent(RigidBody);
                    const otherBox  = otherCol.getBox(otherPos).toPolygon();

                    const response = new SAT.Response();
                    const currentBox = playerCol.getBox(playerPos).toPolygon();
                    if (!SAT.testPolygonPolygon(currentBox, otherBox, response)) continue;

                    if (other.getComponent(Platform)) {
                        // Project previous position using current velocity & delta to determine entry direction
                        const prevX = playerPos.x - playerVel.x * _delta;
                        const prevY = playerPos.y - playerVel.y * _delta;

                        const wasAbove = (prevY + playerCol.height) <= otherPos.y + 4;
                        const wasBelow = prevY >= (otherPos.y + otherCol.height) - 4;
                        const wasLeft  = (prevX + playerCol.width) <= otherPos.x + 4;
                        const wasRight = prevX >= (otherPos.x + otherCol.width) - 4;

                        const pMinX = playerPos.x, pMaxX = playerPos.x + playerCol.width;
                        const pMinY = playerPos.y, pMaxY = playerPos.y + playerCol.height;
                        const oMinX = otherPos.x, oMaxX = otherPos.x + otherCol.width;
                        const oMinY = otherPos.y, oMaxY = otherPos.y + otherCol.height;

                        const overlapX = Math.min(pMaxX, oMaxX) - Math.max(pMinX, oMinX);
                        const overlapY = Math.min(pMaxY, oMaxY) - Math.max(pMinY, oMinY);

                        if (wasAbove && (!wasLeft && !wasRight || overlapY < overlapX)) {
                            response.overlapN.x = 0;
                            response.overlapN.y = 1;
                            response.overlap = overlapY;
                            response.overlapV.x = 0;
                            response.overlapV.y = overlapY;
                        } else if (wasBelow && (!wasLeft && !wasRight || overlapY < overlapX)) {
                            response.overlapN.x = 0;
                            response.overlapN.y = -1;
                            response.overlap = overlapY;
                            response.overlapV.x = 0;
                            response.overlapV.y = -overlapY;
                        } else if (wasLeft && (!wasAbove && !wasBelow || overlapX <= overlapY)) {
                            response.overlapN.x = 1;
                            response.overlapN.y = 0;
                            response.overlap = overlapX;
                            response.overlapV.x = overlapX;
                            response.overlapV.y = 0;
                        } else if (wasRight && (!wasAbove && !wasBelow || overlapX <= overlapY)) {
                            response.overlapN.x = -1;
                            response.overlapN.y = 0;
                            response.overlap = overlapX;
                            response.overlapV.x = -overlapX;
                            response.overlapV.y = 0;
                        }

                        if (playerBody && otherBody) {
                            // Wall-stick prevention: snapshot Y velocity before resolution
                            // and restore it after any predominantly-horizontal (wall) contact,
                            // so walls only affect horizontal motion and gravity is never cancelled.
                            const preVelY = playerVel.y;
                            const isWallContact = Math.abs(response.overlapN.x) > Math.abs(response.overlapN.y);

                            otherBody.body.setPosition(otherPos.x, otherPos.y);

                            playerBody.body.resolveCollision(otherBody.body, response);
                            playerPos.x = playerBody.body.position.x;
                            playerPos.y = playerBody.body.position.y;
                            playerVel.x = playerBody.body.velocity.x;
                            playerVel.y = playerBody.body.velocity.y;

                            // Project out any remaining penetration. Platforms are static
                            // (inverseMass 0), so only the player moves.
                            const percent = 0.4, slop = 0.5;
                            const invMass = playerBody.body.inverseMass;
                            if (invMass > 0) {
                                const correctionMagnitude = Math.max(response.overlap - slop, 0) / invMass * percent;
                                const remainingOverlap = response.overlap - correctionMagnitude;
                                if (remainingOverlap > COLLISION_EPSILON) {
                                    playerPos.x -= response.overlapN.x * remainingOverlap;
                                    playerPos.y -= response.overlapN.y * remainingOverlap;
                                    playerBody.body.position.x = playerPos.x;
                                    playerBody.body.position.y = playerPos.y;
                                }
                            }

                            if (isWallContact) {
                                playerVel.y = preVelY;
                                playerBody.body.velocity.y = preVelY;
                                const velDotN = playerVel.x * response.overlapN.x + playerVel.y * response.overlapN.y;
                                if (velDotN < 0) {
                                    playerVel.x -= response.overlapN.x * velDotN;
                                    playerBody.body.velocity.x = playerVel.x;
                                }
                            }
                        } else if (response.overlap > COLLISION_EPSILON) {
                            playerPos.x -= response.overlapV.x;
                            playerPos.y -= response.overlapV.y;
                        }

                        if (response.overlapN.y > 0.3) {
                            groundedThisFrame.add(playerEntity);
                            // Clear residual downward velocity on landing. Without this it
                            // accumulates unbounded: at platformer fall speeds the per-frame
                            // floor penetration exceeds the engine's deep-overlap threshold
                            // (maxSafeOverlap, px/s-tuned), so resolveCollision's impulse is
                            // energy-bled to zero and never removes vy. Position snapping hides
                            // it while grounded, but it erupts as a fast-fall on walk-off.
                            if (playerVel.y > 0) {
                                playerVel.y = 0;
                                if (playerBody) playerBody.body.velocity.y = 0;
                            }
                        } else if (response.overlapN.y < -0.3 && playerVel.y < 0) {
                            // Ceiling head-bonk: kill upward velocity
                            playerVel.y = 0;
                            if (playerBody) playerBody.body.velocity.y = 0;
                        }
                    }

                    // Collectible — only trigger once across all iterations
                    const collectible = other.getComponent(Collectible);
                    if (collectible && iter === 0) {
                        const cx = other.getComponent(Position)?.x ?? 0;
                        const cy = other.getComponent(Position)?.y ?? 0;
                        const ow = other.getComponent(BoxCollider)?.width  ?? 0;
                        const oh = other.getComponent(BoxCollider)?.height ?? 0;
                        const pcx = cx + ow * 0.5, pcy = cy + oh * 0.5;

                        if (collectible.itemType === 'gem') {
                            this.score += 500;
                            if (this.particles) this.particles.emit('coin_collect', pcx, pcy);
                            (window as any).addFloat?.(cx, cy - 6, '+500', '#7fdcff');
                        } else if (collectible.itemType === '1up') {
                            (window as any).add1up?.();
                            (window as any).addFloat?.(cx, cy - 6, '1UP', '#67d96b');
                            if (this.particles) this.particles.emit('coin_collect', pcx, pcy);
                        } else if (collectible.itemType === 'star') {
                            // We're already iterating the player; set it directly.
                            // (createQuery here would leak a Query every star pickup.)
                            playerEntity.getComponent(Player).star = 360; // ~6s at 60fps
                            (window as any).addFloat?.(cx, cy - 10, 'STAR!', '#ffe06a');
                            if (this.particles) this.particles.emit('coin_collect', pcx, pcy);
                        } else {
                            // coin
                            this.score += collectible.value;
                            (window as any).addFloat?.(cx, cy - 6, '+' + collectible.value, '#ffd23f');
                            if (this.particles) this.particles.emit('coin_collect', pcx, pcy);
                        }
                        this.onScoreChange(this.score);
                        this.world!.removeEntity(other);
                        const special = collectible.itemType === 'gem' || collectible.itemType === 'star' || collectible.itemType === '1up';
                        this.playSound(special ? (this.sounds.gem || this.sounds.pickup) : this.sounds.pickup);
                    }
                }
            }
        } // end SOLVER_ITERATIONS

        // ── Enemy ↔ Player collision (once, after solver) ───────────────────
        for (const playerEntity of this.playerQuery.entities) {
            const playerPos  = playerEntity.getComponent(Position);
            const playerVel  = playerEntity.getComponent(Velocity);
            const playerCol  = playerEntity.getComponent(BoxCollider);
            const player     = playerEntity.getComponent(Player);
            const playerBody = playerEntity.getComponent(RigidBody);
            const playerBox  = playerCol.getBox(playerPos).toPolygon();

            // Tick down invincibility
            if (player.hurtFrames > 0) { player.hurtFrames--; continue; }

            for (const enemyEntity of this.enemyQuery.entities) {
                const enemy    = enemyEntity.getComponent(Enemy);
                if (enemy.dead) continue;

                const enemyPos = enemyEntity.getComponent(Position);
                const enemyCol = enemyEntity.getComponent(BoxCollider);
                const enemyBox = enemyCol.getBox(enemyPos).toPolygon();

                const response = new SAT.Response();
                if (!SAT.testPolygonPolygon(playerBox, enemyBox, response)) continue;

                const isStomp = playerVel.y >= 0 && (playerPos.y + playerCol.height) - enemyPos.y < 24;

                // Star power — kills any enemy on contact
                if (player.star > 0 && !isStomp) {
                    enemy.dead = true;
                    this.score += 200;
                    this.onScoreChange(this.score);
                    (window as any).addFloat?.(enemyPos.x, enemyPos.y - 4, '+200', '#ffe06a');
                    if (this.particles) this.particles.emit('coin_collect', enemyPos.x + enemyCol.width * 0.5, enemyPos.y + enemyCol.height * 0.5);
                    playerVel.y = Math.min(playerVel.y, -7);
                    if (playerBody?.body) {
                        playerBody.body.velocity.y = playerVel.y;
                    }
                    continue;
                }

                if (isStomp) {
                    // ── Stomp: kill enemy, bounce player ─────────────────────
                    enemy.dead = true;
                    playerVel.y = -11.5;
                    if (playerBody?.body) {
                        playerBody.body.velocity.y = -11.5;
                    }
                    this.score += 100;
                    this.onScoreChange(this.score);
                    (window as any).addFloat?.(enemyPos.x, enemyPos.y - 4, '+100', '#fff4d6');
                    player.landSquash = 1;
                    this.playSound(this.sounds.enemyDie || this.sounds.land);
                    (window as any).screenShakeIntensity = 8;
                    (window as any).screenShakeDuration  = 12;
                    if (this.particles) {
                        this.particles.emit('dust', enemyPos.x + enemyCol.width * 0.5, enemyPos.y + enemyCol.height * 0.5);
                    }
                } else {
                    // ── Side hit: deduct HP & respawn player ────────────────
                    if (enemy.type === 'bee') {
                        enemy.dead = true;
                        if (this.particles) this.particles.emit('dust', enemyPos.x + enemyCol.width * 0.5, enemyPos.y + enemyCol.height * 0.5);
                    }

                    player.hp--;
                    player.lives--;
                    player.hurtFrames = 90;
                    (window as any).screenShakeIntensity = 18;
                    (window as any).screenShakeDuration  = 24;
                    this.playSound(this.sounds.hurt);
                    if (this.particles) this.particles.emit('dust', playerPos.x + playerCol.width * 0.5, playerPos.y + playerCol.height * 0.5);

                    if (player.hp <= 0 || player.lives <= 0) {
                        (window as any).gameInstance?.gameOver();
                    } else {
                        const spawn = playerEntity.getComponent(SpawnPosition);
                        if (spawn) { playerPos.x = spawn.x; playerPos.y = spawn.y; }
                        else { playerPos.y = 962; }
                        playerVel.x = 0; playerVel.y = 0;
                        if (playerBody?.body) {
                            playerBody.body.setPosition(playerPos.x, playerPos.y);
                            playerBody.body.setVelocity(0, 0);
                        }
                    }
                }
            }
        }

        // ── Projectile → enemy / solid collision ───────────────────────────
        const projToRemove: any[] = [];

        this.projQuery.entities.forEach((projEntity: any) => {
            const projPos = projEntity.getComponent(Position);
            const projCol = projEntity.getComponent(BoxCollider);
            const projBox = projCol.getBox(projPos).toPolygon();

            // 1. Check enemy collision
            for (const enemyEntity of this.enemyQuery.entities) {
                const enemy = enemyEntity.getComponent(Enemy);
                if (enemy.dead) continue;
                const enemyPos2 = enemyEntity.getComponent(Position);
                const enemyCol2 = enemyEntity.getComponent(BoxCollider);
                const enemyBox2 = enemyCol2.getBox(enemyPos2).toPolygon();
                const resp = new SAT.Response();
                if (SAT.testPolygonPolygon(projBox, enemyBox2, resp)) {
                    enemy.dead = true;
                    this.score += 100;
                    this.onScoreChange(this.score);
                    this.playSound(this.sounds.enemyDie);
                    (window as any).addFloat?.(enemyPos2.x, enemyPos2.y - 4, '+100', '#ffe06a');
                    if (this.particles) {
                        this.particles.emit('coin_collect',
                            enemyPos2.x + enemyCol2.width * 0.5,
                            enemyPos2.y + enemyCol2.height * 0.5
                        );
                    }
                    projToRemove.push(projEntity);
                    return; // Done checking this projectile
                }
            }

            // 2. Check solid platform/crate collision
            for (const otherEntity of this.collidersQuery.entities) {
                if (otherEntity === projEntity) continue;
                if (!otherEntity.getComponent(Platform)) continue;

                const solidPos = otherEntity.getComponent(Position);
                const solidCol = otherEntity.getComponent(BoxCollider);
                const solidBox = solidCol.getBox(solidPos).toPolygon();
                const resp = new SAT.Response();
                if (SAT.testPolygonPolygon(projBox, solidBox, resp)) {
                    if (this.particles) {
                        this.particles.emit('dust', projPos.x + 6, projPos.y + 6);
                    }
                    projToRemove.push(projEntity);
                    break;
                }
            }
        });
        projToRemove.forEach(e => this.world!.removeEntity(e));

        // ── Grounded state (once, after all iterations) ─────────────────────
        for (const playerEntity of this.playerQuery.entities) {
            const player    = playerEntity.getComponent(Player);
            const playerPos = playerEntity.getComponent(Position);
            const playerCol = playerEntity.getComponent(BoxCollider);
            if (player.groundedFrames > 0) player.groundedFrames--;
            const wasAirborne = !player.grounded;
            if (groundedThisFrame.has(playerEntity)) {
                player.groundedFrames = 8;
                player.grounded = true;
                if (wasAirborne) {
                    player.landSquash = 1;
                    this.playSound(this.sounds.land);
                    if (this.particles && playerPos && playerCol) {
                        this.particles.emit('dust',
                            playerPos.x + playerCol.width  * 0.5,
                            playerPos.y + playerCol.height
                        );
                    }
                }
            } else {
                player.grounded = player.groundedFrames > 0;
            }
        }

        // ── Player ↔ Portal exit collision (win check) ─────────────────────
        for (const playerEntity of this.playerQuery.entities) {
            const playerPos = playerEntity.getComponent(Position);
            const playerCol = playerEntity.getComponent(BoxCollider);
            const playerBox = playerCol.getBox(playerPos).toPolygon();

            for (const portalEntity of this.portalQuery.entities) {
                const portalPos = portalEntity.getComponent(Position);
                const portalCol = portalEntity.getComponent(BoxCollider);
                const portalBox = portalCol.getBox(portalPos).toPolygon();

                const response = new SAT.Response();
                if (SAT.testPolygonPolygon(playerBox, portalBox, response)) {
                    (window as any).gameInstance?.victory();
                }
            }
        }
    }
}
