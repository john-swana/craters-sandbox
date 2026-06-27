import { EntityComponentSystem as ECS } from "craters";
import { SpriteRender } from "../components/SpriteRender";

export class AnimationSystem extends ECS.System {
    // Cached query — created once in initialize(), reused every frame.
    private query!: ECS.Query;

    initialize(): void {
        this.query = this.world!.createQuery([SpriteRender]);
    }

    execute(delta: number) {
        this.query.entities.forEach((entity: any) => {
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
