import { EntityComponentSystem as ECS } from "craters";
import { Position } from "../components/Position";
import { Velocity } from "../components/Velocity";
import { SpawnPosition } from "../components/SpawnPosition";
import { Player } from "../components/Player";
import { RigidBody } from "../components/RigidBody";

export class RespawnSystem extends ECS.System {
    // Cached query — created once in initialize(), reused every frame.
    private query!: ECS.Query;

    initialize(): void {
        this.query = this.world!.createQuery([Position, Velocity, SpawnPosition]);
    }

    execute(_delta: number) {
        const RESPAWN_THRESHOLD_Y = 1500;  // level bottom ~1400; trigger just past that

        this.query.entities.forEach((entity: any) => {
            const position = entity.getComponent(Position);
            const velocity = entity.getComponent(Velocity);
            const spawnPosition = entity.getComponent(SpawnPosition);
            const player = entity.getComponent(Player);
            const rigidBody = entity.getComponent(RigidBody);

            if (position.y > RESPAWN_THRESHOLD_Y) {
                position.x = spawnPosition.x;
                position.y = spawnPosition.y;
                velocity.x = 0;
                velocity.y = 0;

                if (rigidBody?.body) {
                    rigidBody.body.setPosition(position.x, position.y);
                    rigidBody.body.setVelocity(0, 0);
                }

                if (player) {
                    player.lives--;
                    player.hurtFrames = 90;

                    (window as any).screenShakeIntensity = 20;
                    (window as any).screenShakeDuration = 25;

                    const game = (window as any).gameInstance;
                    if (game) {
                        if (!game.muted && game.sounds) {
                            if (player.lives > 0) {
                                if (game.sounds.fall) {
                                    game.sounds.fall.play();
                                } else if (game.sounds.hurt) {
                                    game.sounds.hurt.play();
                                }
                            }
                        }
                        if (player.lives <= 0) {
                            game.gameOver();
                        }
                    }
                }
            }
        });
    }
}
