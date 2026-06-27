import { EntityComponentSystem as ECS } from "craters";
import { Position } from "../components/Position";
import { BoxCollider } from "../components/BoxCollider";
import { TileRender } from "../components/TileRender";
import { SpriteRender } from "../components/SpriteRender";
import { Player } from "../components/Player";
import { Projectile } from "../components/Projectile";

// The fireball projectile sprite is just a region of the Kenney tiles atlas —
// no separate asset needed.
const FIREBALL = { x: 715, y: 130, w: 64, h: 64 };

export class RenderSystem extends ECS.System {
    renderer: any;
    private tilesImage: HTMLImageElement | null = null;   // Kenney tiles atlas (holds the fireball)
    cameraX: number = 0;
    cameraY: number = 0;

    // Cached query — created once in initialize(), reused every frame.
    private query!: ECS.Query;

    constructor(renderer: any, tilesImage?: HTMLImageElement) {
        super();
        this.renderer = renderer;
        this.tilesImage = tilesImage ?? null;
    }

    initialize(): void {
        this.query = this.world!.createQuery([Position]);
    }

    execute(_delta: number) {
        // ── Screen shake offsets ──────────────────────────────────────────
        let shakeX = 0;
        let shakeY = 0;
        if ((window as any).screenShakeDuration > 0) {
            const intensity = (window as any).screenShakeIntensity || 5;
            shakeX = (Math.random() - 0.5) * intensity;
            shakeY = (Math.random() - 0.5) * intensity;
            (window as any).screenShakeDuration--;
        }

        const offset = { x: this.cameraX + shakeX, y: this.cameraY + shakeY };
        const ctx    = this.renderer.context as CanvasRenderingContext2D;

        this.query.entities.forEach((entity: any) => {
            const pos          = entity.getComponent(Position);
            const col          = entity.getComponent(BoxCollider);
            const tileRender   = entity.getComponent(TileRender);
            const spriteRender = entity.getComponent(SpriteRender);
            const proj         = entity.getComponent(Projectile);

            if (proj) {
                const size = 20;
                ctx.save();
                const cx = pos.x + (col ? col.width : 12) * 0.5;
                const cy = pos.y + (col ? col.height : 12) * 0.5;
                ctx.translate(Math.round(cx + offset.x), Math.round(cy + offset.y));
                ctx.rotate(proj.spin);
                if (this.tilesImage) {
                    this.renderer.drawImage(
                        this.tilesImage,
                        FIREBALL.x, FIREBALL.y, FIREBALL.w, FIREBALL.h,
                        -size / 2, -size / 2, size, size
                    );
                }
                ctx.restore();

                const showDebug = (window as any).showDebug;
                if (showDebug && col) {
                    this.renderer.drawRect(
                        Math.floor(pos.x + offset.x), Math.floor(pos.y + offset.y),
                        col.width, col.height, "rgba(0, 255, 100, 0.6)", false
                    );
                }
                return;
            }

            if (tileRender) {
                // Use renderer.drawImage() for DPR pixel-snapping on every blit.
                // 0.5px source inset prevents texel bleed from neighbouring atlas tiles.
                this.renderer.drawImage(
                    tileRender.image,
                    tileRender.srcX + 0.5, tileRender.srcY + 0.5,
                    tileRender.srcW - 1,  tileRender.srcH - 1,
                    Math.round(pos.x + offset.x), Math.round(pos.y + offset.y),
                    tileRender.width, tileRender.height
                );

            } else if (spriteRender) {
                // Flash the sprite on alternate frames while the player is hurt.
                const playerComp = entity.getComponent(Player);
                if (playerComp && playerComp.hurtFrames > 0) {
                    if (Math.floor(playerComp.hurtFrames / 4) % 2 === 0) {
                        return; // skip this frame to flash
                    }
                }

                const anim  = spriteRender.animations[spriteRender.currentAnim];
                const frame = anim ? anim.frames[spriteRender.frameIndex] : 0;

                let srcX: number, srcY: number, srcW: number, srcH: number;

                if (spriteRender.atlasFrames && spriteRender.atlasFrames[frame]) {
                    // Texture-atlas sprite — each frame has its own {x,y,w,h} rect.
                    const af = spriteRender.atlasFrames[frame];
                    srcX = af.x; srcY = af.y; srcW = af.w; srcH = af.h;
                } else {
                    // Uniform-grid sprite — classic row/column lookup.
                    const cols = Math.floor(spriteRender.image.width / spriteRender.frameWidth);
                    srcX = (frame % cols) * spriteRender.frameWidth;
                    srcY = Math.floor(frame / cols) * spriteRender.frameHeight;
                    srcW = spriteRender.frameWidth;
                    srcH = spriteRender.frameHeight;
                }

                ctx.save();

                // Destination size = source frame × render scale (lets big atlas
                // frames like Kenney's 128px characters draw at game size).
                const rs    = spriteRender.scale ?? 1;
                const destW = srcW * rs;
                const destH = srcH * rs;

                const drawX = Math.floor(pos.x - spriteRender.offsetX + offset.x);
                const drawY = Math.floor(pos.y - spriteRender.offsetY + offset.y);
                const spriteCX = drawX + destW / 2;
                const spriteCY = drawY + destH / 2;

                // ── Star glow aura ─────────────────────────────────────────
                const playerComp2 = entity.getComponent(Player);
                if (playerComp2 && playerComp2.star > 0) {
                    const pulse = 0.35 + 0.3 * Math.sin(Date.now() * 0.006);
                    const gg = ctx.createRadialGradient(spriteCX, spriteCY, 4, spriteCX, spriteCY, 48);
                    gg.addColorStop(0, `rgba(255,224,120,${pulse})`);
                    gg.addColorStop(1, 'rgba(255,224,120,0)');
                    ctx.fillStyle = gg;
                    ctx.beginPath();
                    ctx.arc(spriteCX, spriteCY, 48, 0, Math.PI * 2);
                    ctx.fill();
                    // Flash when star power is almost expired
                    if (playerComp2.star < 72 && Math.floor(Date.now() / 66) % 2 === 0) {
                        ctx.restore();
                        return;
                    }
                }

                // ── Flip + squash/stretch transform (anchored at bottom-centre) ──
                const sx = playerComp2 ? playerComp2.sx : 1;
                const sy = playerComp2 ? playerComp2.sy : 1;

                ctx.translate(spriteCX, drawY + destH);
                ctx.scale(spriteRender.flipX ? -sx : sx, sy);
                ctx.translate(-spriteCX, -(drawY + destH));

                // renderer.drawImage() applies DPR pixel-snapping internally.
                this.renderer.drawImage(
                    spriteRender.image,
                    srcX, srcY, srcW, srcH,
                    drawX, drawY, destW, destH
                );

                ctx.restore();
            }

            // ── Debug collider outlines (toggle with F2) ───────────────────
            if ((window as any).showDebug && col) {
                this.renderer.drawRect(
                    Math.floor(pos.x + offset.x), Math.floor(pos.y + offset.y),
                    col.width, col.height, "rgba(0, 255, 100, 0.6)", false
                );
            }
        });
    }
}
