import { EntityComponentSystem as ECS } from "craters";
import { Position } from "../components/Position";
import { Velocity } from "../components/Velocity";
import { Acceleration } from "../components/Acceleration";
import { BoxCollider } from "../components/BoxCollider";
import { Player } from "../components/Player";
import { RigidBody } from "../components/RigidBody";

const GRAVITY = 0.5;
const FALL_GRAVITY_MULTIPLIER = 1.8; // Fall faster than rise for snappy arc
const SLEEP_THRESHOLD = 0.1;
const SLEEP_TIME = 60;

export class PhysicsSystem extends ECS.System {
    execute(delta: number) {
        const query = this.world.createQuery([Position, Velocity, BoxCollider]);

        // Run physics in smaller sub-steps for better stability
        const subSteps = 8;
        const subDelta = delta / subSteps;

        for (let i = 0; i < subSteps; i++) {
            query.entities.forEach((entity: any) => {
                const pos = entity.getComponent(Position);
                const vel = entity.getComponent(Velocity);
                const acc = entity.getComponent(Acceleration);
                const player = entity.getComponent(Player);
                const rigidBody = entity.getComponent(RigidBody);

                // If entity has a Craters RigidBody, use it for physics
                if (rigidBody && rigidBody.body) {
                    const body = rigidBody.body;

                    // Sync ECS state TO RigidBody
                    body.setPosition(pos.x, pos.y);
                    body.setVelocity(vel.x, vel.y);

                    // Apply gravity (as a force or acceleration)
                    // Craters RigidBody uses force/mass for acceleration
                    // F = ma -> F = m * gravity
                    if (!body.isStatic && !body.isSleeping) {
                        // Apply gravity force
                        // We need to apply it every sub-step
                        // Gravity is 0.5 pixels/frame^2 in original code
                        // RigidBody.integrate takes dt

                        // Fall gravity multiplier: player falls faster than they rise.
                        // Asymmetric arc = snappier, more controllable feel.
                        const isPlayer = !!entity.getComponent(Player);
                        const isFalling = body.velocity.y > 0;
                        const gravScale = (isPlayer && isFalling) ? FALL_GRAVITY_MULTIPLIER : 1;
                        body.velocity.y += GRAVITY * subDelta * gravScale;
                    }

                    // Integrate
                    body.integrate(subDelta);

                    // Sync ECS state FROM RigidBody
                    pos.x = body.position.x;
                    pos.y = body.position.y;
                    vel.x = body.velocity.x;
                    vel.y = body.velocity.y;

                    // Update sleeping state for visualization/logic if needed
                    // rigidBody.sleeping = body.isSleeping; // If we wanted to expose it
                }
                // Fallback to manual physics for Player or entities without RigidBody
                else {
                    // Calculate total acceleration
                    let accX = 0;
                    let accY = GRAVITY;

                    if (acc) {
                        accX += acc.x;
                        accY += acc.y;
                    }

                    // Apply acceleration to velocity
                    vel.x += accX * subDelta;
                    vel.y += accY * subDelta;

                    // Apply velocity to position
                    pos.x += vel.x * subDelta;
                    pos.y += vel.y * subDelta;
                }

                // Only clamp Y for falling off bottom

            });
        }
    }
}
