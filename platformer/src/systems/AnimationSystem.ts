import { EntityComponentSystem as ECS } from "craters";
import { SpriteRender } from "../components/SpriteRender";

export class AnimationSystem extends ECS.System {
    execute(delta: number) {
        const query = this.world.createQuery([SpriteRender]);

        query.entities.forEach((entity: any) => {
            const sprite = entity.getComponent(SpriteRender);
            if (sprite.currentAnim && sprite.animations[sprite.currentAnim]) {
                const anim = sprite.animations[sprite.currentAnim];
                sprite.timer += delta * 0.016; // Approximate seconds

                if (sprite.timer >= anim.speed) {
                    sprite.timer = 0;
                    sprite.frameIndex++;
                    if (sprite.frameIndex >= anim.frames.length) {
                        if (anim.loop) {
                            sprite.frameIndex = 0;
                        } else {
                            sprite.frameIndex = anim.frames.length - 1;
                        }
                    }
                }
            }
        });
    }
}
