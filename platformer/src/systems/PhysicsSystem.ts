import { EntityComponentSystem as ECS } from "craters";
import { Position } from "../components/Position";
import { Velocity } from "../components/Velocity";
import { BoxCollider } from "../components/BoxCollider";
import { Player } from "../components/Player";
import { RigidBody } from "../components/RigidBody";
import { Projectile } from "../components/Projectile";

const GRAVITY = 0.5;
const FALL_GRAVITY_MULTIPLIER = 1.8; // Fall faster than rise for snappy arc

export class PhysicsSystem extends ECS.System {
    // Cached query — created once in initialize(), reused every frame.
    private query!: ECS.Query;

    initialize(): void {
        this.query = this.world!.createQuery([Position, Velocity, BoxCollider]);
    }

    execute(delta: number) {
        // Run physics in smaller sub-steps for better stability
        const subSteps = 8;
        const subDelta = delta / subSteps;

        for (let i = 0; i < subSteps; i++) {
            this.query.entities.forEach((entity: any) => {
                const pos = entity.getComponent(Position);
                const vel = entity.getComponent(Velocity);
                const player = entity.getComponent(Player);
                const rigidBody = entity.getComponent(RigidBody);

                // If entity has a Craters RigidBody, delegate physics to it.
                if (rigidBody && rigidBody.body) {
                    const body = rigidBody.body;

                    // Sync ECS state → RigidBody
                    body.setPosition(pos.x, pos.y);
                    body.setVelocity(vel.x, vel.y);

                    if (!body.isStatic && !body.isSleeping) {
                        const isPlayer = !!entity.getComponent(Player);
                        const isDashing = isPlayer && player && player.dashTime > 0;
                        if (!isDashing) {
                            // Asymmetric gravity: fall faster than rise for snappier arc.
                            const isFalling = body.velocity.y > 0;
                            const gravScale = (isPlayer && isFalling) ? FALL_GRAVITY_MULTIPLIER : 1;
                            body.velocity.y += GRAVITY * subDelta * gravScale;
                        }
                    }

                    body.integrate(subDelta);

                    // Sync RigidBody → ECS state
                    pos.x = body.position.x;
                    pos.y = body.position.y;
                    vel.x = body.velocity.x;
                    vel.y = body.velocity.y;
                }
                // Fallback: simple Euler integration for lightweight entities.
                else {
                    const accX = 0;
                    const accY = entity.getComponent(Projectile) ? 0 : GRAVITY;

                    vel.x += accX * subDelta;
                    vel.y += accY * subDelta;

                    pos.x += vel.x * subDelta;
                    pos.y += vel.y * subDelta;
                }
            });
        }
    }
}
