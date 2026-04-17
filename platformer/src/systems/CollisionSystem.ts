import { EntityComponentSystem as ECS, SAT, QuadTree } from "craters";
const { Vector, Box } = SAT;
import { Position } from "../components/Position";
import { Velocity } from "../components/Velocity";
import { BoxCollider } from "../components/BoxCollider";
import { Player } from "../components/Player";
import { Platform } from "../components/Platform";
import { Crate } from "../components/Crate";
import { Collectible } from "../components/Collectible";
import { RigidBody } from "../components/RigidBody";

// Number of solver iterations per frame.
// With bottom-up crate sorting, a stable tower converges in ~1 pass.
// Extra iterations handle dynamic scenarios (player landing on moving stack).
const SOLVER_ITERATIONS = 4;
const COLLISION_EPSILON = 0.01;

export class CollisionSystem extends ECS.System {
    sounds: any;
    score: number;
    onScoreChange: (score: number) => void;

    constructor(sounds: any, onScoreChange: (score: number) => void) {
        super();
        this.sounds = sounds;
        this.score = 0;
        this.onScoreChange = onScoreChange;
    }

    execute(delta: number) {
        // ── Broad-phase QuadTree ────────────────────────────────────────────────
        const bounds = new Box(new Vector(-10000, -10000), 20000, 20000);
        const qt = new QuadTree.QuadTree(bounds);
        const colliders = this.world.createQuery([Position, BoxCollider]);
        const qtObjects: any[] = [];

        colliders.entities.forEach((entity: any) => {
            const pos = entity.getComponent(Position);
            const col = entity.getComponent(BoxCollider);
            const qtObj = { entity, getAABBAsBox: () => col.getBox(pos) };
            qtObjects.push(qtObj);
            qt.insert(qtObj);
        });

        const playerQuery = this.world.createQuery([Position, Velocity, BoxCollider, Player]);
        const crateQuery  = this.world.createQuery([Position, Velocity, BoxCollider, Crate]);

        // Sort crates bottom-up once (largest screen-Y first = closest to floor).
        // Resolving ground contacts before upper contacts propagates corrections
        // up the whole tower in a single iteration — no N-iteration blowup.
        const sortedCrates = [...crateQuery.entities].sort((a: any, b: any) =>
            b.getComponent(Position).y - a.getComponent(Position).y
        );

        const groundedThisFrame = new Set<any>();

        // ── Iterative narrow-phase solver ───────────────────────────────────────
        for (let iter = 0; iter < SOLVER_ITERATIONS; iter++) {

            // ── 1. Crates → platform / other crates (bottom-up) ────────────────
            for (const crateEntity of sortedCrates) {
                const cratePos  = crateEntity.getComponent(Position);
                const crateVel  = crateEntity.getComponent(Velocity);
                const crateCol  = crateEntity.getComponent(BoxCollider);
                const crateBody = crateEntity.getComponent(RigidBody);
                const crateBox  = crateCol.getBox(cratePos).toPolygon();

                const crateQtObj = qtObjects.find((o: any) => o.entity === crateEntity);
                const candidates: any[] = [];
                if (crateQtObj) qt.retrieve(candidates, crateQtObj);

                for (const candidate of candidates) {
                    const other = candidate.entity;
                    if (other === crateEntity) continue;
                    if (!other.getComponent(Platform) && !other.getComponent(Crate)) continue;

                    const otherPos  = other.getComponent(Position);
                    const otherCol  = other.getComponent(BoxCollider);
                    const otherBody = other.getComponent(RigidBody);
                    const otherBox  = otherCol.getBox(otherPos).toPolygon();

                    const response = new SAT.Response();
                    if (!SAT.testPolygonPolygon(crateBox, otherBox, response)) continue;

                    if (crateBody && otherBody) {
                        crateBody.body.resolveCollision(otherBody.body, response);
                        cratePos.x = crateBody.body.position.x;
                        cratePos.y = crateBody.body.position.y;
                        crateVel.x = crateBody.body.velocity.x;
                        crateVel.y = crateBody.body.velocity.y;

                        if (other.getComponent(Crate)) {
                            const ov = other.getComponent(Velocity);
                            otherPos.x = otherBody.body.position.x;
                            otherPos.y = otherBody.body.position.y;
                            ov.x = otherBody.body.velocity.x;
                            ov.y = otherBody.body.velocity.y;
                        }
                    } else if (response.overlap > COLLISION_EPSILON) {
                        cratePos.x -= response.overlapV.x;
                        cratePos.y -= response.overlapV.y;
                    }
                }
            }

            // ── 2. Player → platform / crates ──────────────────────────────────
            for (const playerEntity of playerQuery.entities) {
                const playerPos  = playerEntity.getComponent(Position);
                const playerVel  = playerEntity.getComponent(Velocity);
                const playerCol  = playerEntity.getComponent(BoxCollider);
                const playerBody = playerEntity.getComponent(RigidBody);
                const playerBox  = playerCol.getBox(playerPos).toPolygon();

                const playerQtObj = qtObjects.find((o: any) => o.entity === playerEntity);
                const candidates: any[] = [];
                if (playerQtObj) qt.retrieve(candidates, playerQtObj);

                for (const candidate of candidates) {
                    const other = candidate.entity;
                    if (other === playerEntity) continue;

                    const otherPos  = other.getComponent(Position);
                    const otherCol  = other.getComponent(BoxCollider);
                    const otherBody = other.getComponent(RigidBody);
                    const otherBox  = otherCol.getBox(otherPos).toPolygon();

                    const response = new SAT.Response();
                    if (!SAT.testPolygonPolygon(playerBox, otherBox, response)) continue;

                    if (other.getComponent(Platform) || other.getComponent(Crate)) {
                        if (playerBody && otherBody) {
                            // Wall-stick prevention:
                            // resolveCollision applies friction in the tangential direction.
                            // For a wall hit (horizontal normal, vertical tangent) this means
                            // friction damps the player's downward velocity.
                            // With 4 solver iters × 8 physics sub-steps = up to 32 contacts/frame,
                            // even small per-contact friction accumulates and cancels gravity,
                            // making the player float when leaning against a wall.
                            // Fix: snapshot Y velocity before resolution and restore it afterwards
                            // for any predominantly-horizontal (wall) contact, so walls only
                            // affect horizontal motion and gravity is never neutralised.
                            const preVelY = playerVel.y;
                            const isWallContact = Math.abs(response.overlapN.x) > Math.abs(response.overlapN.y);

                            playerBody.body.resolveCollision(otherBody.body, response);
                            playerPos.x = playerBody.body.position.x;
                            playerPos.y = playerBody.body.position.y;
                            playerVel.x = playerBody.body.velocity.x;
                            playerVel.y = playerBody.body.velocity.y;

                            if (isWallContact) {
                                // Restore vertical velocity — wall friction must not oppose gravity
                                playerVel.y = preVelY;
                                playerBody.body.velocity.y = preVelY;
                            }

                            if (other.getComponent(Crate)) {
                                const ov = other.getComponent(Velocity);
                                otherPos.x = otherBody.body.position.x;
                                otherPos.y = otherBody.body.position.y;
                                ov.x = otherBody.body.velocity.x;
                                ov.y = otherBody.body.velocity.y;
                            }
                        } else if (response.overlap > COLLISION_EPSILON) {
                            playerPos.x -= response.overlapV.x;
                            playerPos.y -= response.overlapV.y;
                        }

                        if (response.overlapN.y > 0.3) {
                            // Surface below player — grounded
                            groundedThisFrame.add(playerEntity);
                        } else if (response.overlapN.y < -0.3 && playerVel.y < 0) {
                            // Ceiling above player — head bonk: kill upward velocity
                            playerVel.y = 0;
                            if (playerBody) playerBody.body.velocity.y = 0;
                        }
                    }

                    // Collectible — only trigger once across all iterations
                    const collectible = other.getComponent(Collectible);
                    if (collectible && iter === 0) {
                        this.score += collectible.value;
                        this.onScoreChange(this.score);
                        this.world.removeEntity(other);
                        if (this.sounds.pickup) this.sounds.pickup.play();
                    }
                }
            }
        } // end SOLVER_ITERATIONS

        // ── Grounded state (once, after all iterations) ─────────────────────────
        for (const playerEntity of playerQuery.entities) {
            const player = playerEntity.getComponent(Player);
            if (player.groundedFrames > 0) player.groundedFrames--;
            const wasAirborne = !player.grounded;
            if (groundedThisFrame.has(playerEntity)) {
                player.groundedFrames = 8; // coyote window: ~133ms at 60fps
                player.grounded = true;
                if (wasAirborne && this.sounds.land) this.sounds.land.play();
            } else {
                player.grounded = player.groundedFrames > 0;
            }
        }
    }
}
