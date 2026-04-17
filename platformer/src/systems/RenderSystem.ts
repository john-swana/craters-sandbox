import { EntityComponentSystem as ECS } from "craters";
import { Position } from "../components/Position";
import { BoxCollider } from "../components/BoxCollider";
import { RenderBox } from "../components/RenderBox";
import { TileRender } from "../components/TileRender";
import { SpriteRender } from "../components/SpriteRender";





export class RenderSystem extends ECS.System {
    renderer: any;

    cameraX: number = 0;
    cameraY: number = 0;

    constructor(renderer: any) {
        super();
        this.renderer = renderer;
    }

    execute(delta: number) {
        const query = this.world.createQuery([Position]);
        const offset = { x: this.cameraX, y: this.cameraY };
        const ctx = this.renderer.context;

        query.entities.forEach((entity: any) => {
            const pos = entity.getComponent(Position);
            const col = entity.getComponent(BoxCollider);
            const render = entity.getComponent(RenderBox);
            const tileRender = entity.getComponent(TileRender);
            const spriteRender = entity.getComponent(SpriteRender);

            if (tileRender) {
                // Draw tile sprite.
                // Source rect is inset by 0.5px on every side: the sampler at a tile
                // edge can land exactly on the texel boundary in the atlas and bleed
                // 1px of the neighbour tile's color. A half-texel inset keeps the
                // sample safely inside the tile's own pixels. Destination stays at
                // full tile size so there is no visible gap between tiles.
                this.renderer.drawImage(
                    tileRender.image,
                    tileRender.srcX + 0.5, tileRender.srcY + 0.5,
                    tileRender.width - 1,  tileRender.height - 1,
                    Math.round(pos.x + offset.x), Math.round(pos.y + offset.y),
                    tileRender.width, tileRender.height
                );
            } else if (spriteRender) {
                // Draw sprite with animation and offset
                const anim = spriteRender.animations[spriteRender.currentAnim];
                const frame = anim ? anim.frames[spriteRender.frameIndex] : 0;

                // Calculate source position in spritesheet
                const cols = Math.floor(spriteRender.image.width / spriteRender.frameWidth);
                const srcX = (frame % cols) * spriteRender.frameWidth;
                const srcY = Math.floor(frame / cols) * spriteRender.frameHeight;

                ctx.save();

                // Position at the entity pos minus offset
                // Round to nearest pixel to prevent jitter
                let drawX = Math.floor(pos.x - spriteRender.offsetX + offset.x);
                let drawY = Math.floor(pos.y - spriteRender.offsetY + offset.y);

                // Handle flipping
                if (spriteRender.flipX) {
                    const spriteCenterX = drawX + spriteRender.frameWidth / 2;
                    ctx.translate(spriteCenterX, drawY + spriteRender.frameHeight / 2);
                    ctx.scale(-1, 1);
                    ctx.translate(-spriteCenterX, -(drawY + spriteRender.frameHeight / 2));
                }

                ctx.drawImage(
                    spriteRender.image,
                    srcX, srcY, spriteRender.frameWidth, spriteRender.frameHeight,
                    drawX, drawY, spriteRender.frameWidth, spriteRender.frameHeight
                );

                ctx.restore();
            }

            // Draw debug box if present (on top of sprites)
            if (render && col) {
                // Draw rect
                this.renderer.drawRect(Math.floor(pos.x + offset.x), Math.floor(pos.y + offset.y), col.width, col.height, render.color, render.fill);
            }











        });
    }
}
