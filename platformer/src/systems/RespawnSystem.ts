import { EntityComponentSystem as ECS } from "craters";
import { Position } from "../components/Position";
import { Velocity } from "../components/Velocity";
import { SpawnPosition } from "../components/SpawnPosition";

export class RespawnSystem extends ECS.System {
    execute(delta: number) {
        const RESPAWN_THRESHOLD_Y = 1000;
        const query = this.world.createQuery([Position, Velocity, SpawnPosition]);

        query.entities.forEach((entity: any) => {
            const position = entity.getComponent(Position);
            const velocity = entity.getComponent(Velocity);
            const spawnPosition = entity.getComponent(SpawnPosition);

            if (position.y > RESPAWN_THRESHOLD_Y) {
                position.x = spawnPosition.x;
                position.y = spawnPosition.y;
                velocity.x = 0;
                velocity.y = 0;
            }
        });
    }
}
