import { EntityComponentSystem as ECS, ParticleSystem as CoreParticleSystem } from "craters";
import type { ParticleEmitConfig } from "craters";

// ─────────────────────────────────────────────────────────────────────────────
// Preset types
// ─────────────────────────────────────────────────────────────────────────────

export type ParticlePreset = "dust" | "coin_collect" | "jump_burst" | "run_puff";

/** Map of pre-loaded images keyed by preset name — built in Game.loadResources(). */
export interface ParticleImageMap {
    dust:         HTMLImageElement[];
    coin_collect: HTMLImageElement[];
    jump_burst:   HTMLImageElement[];
    run_puff:     HTMLImageElement[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Preset physics / visual config  (no image paths — images are injected)
// ─────────────────────────────────────────────────────────────────────────────

function buildPresets(imgs: ParticleImageMap): Record<ParticlePreset, ParticleEmitConfig> {
    return {
        // Dirt chunks fly sideways + slightly up on landing
        dust: {
            images: imgs.dust,
            count: 7,
            colors: ["#c8a87a", "#b09060", "#d4bc96", "#a07848"],
            minSize: 18, maxSize: 36,
            minLife: 14, maxLife: 24,
            speed: 3.2,
            gravity: 0.22,
            drag: 0.87,
            biasY: -0.45, biasStrength: 0.3,
            minRotationSpeed: -0.15, maxRotationSpeed: 0.15,
        },

        // Gold stars + sparks scatter and drift upward on coin pickup
        coin_collect: {
            images: imgs.coin_collect,
            count: 10,
            colors: ["#FFD700", "#FFC200", "#FFE566", "#FFAA00"],
            minSize: 20, maxSize: 42,
            minLife: 20, maxLife: 34,
            speed: 3.8,
            gravity: -0.05,
            drag: 0.91,
            biasY: -1, biasStrength: 0.25,
            minRotationSpeed: -0.2, maxRotationSpeed: 0.2,
        },

        // Bright circle + sparks burst downward when the player jumps
        jump_burst: {
            images: imgs.jump_burst,
            count: 6,
            colors: ["#a8e4ff", "#d0f4ff", "#ffffff", "#80ccf0"],
            minSize: 22, maxSize: 44,
            minLife: 10, maxLife: 18,
            speed: 3.2,
            gravity: 0.28,
            drag: 0.84,
            biasY: 1, biasStrength: 0.55,
            minRotationSpeed: -0.05, maxRotationSpeed: 0.05,
        },

        // Soft smoke puffs trail behind the player while running
        run_puff: {
            images: imgs.run_puff,
            count: 2,
            colors: ["#d8d0c8", "#c0b8b0", "#e4dcd4"],
            minSize: 16, maxSize: 30,
            minLife: 9, maxLife: 16,
            speed: 1.4,
            gravity: -0.04,
            drag: 0.86,
            biasY: -0.3, biasStrength: 0.2,
            minRotationSpeed: -0.08, maxRotationSpeed: 0.08,
        },
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// ECS wrapper
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ECS System that wraps the engine's generic ParticleSystem with
 * platformer-specific presets.  Register this system LAST so particles
 * always draw on top of all geometry.
 *
 * Images are loaded by Game.loadResources() via AssetsManager and passed in
 * at construction time — no asset loading happens here.
 */
export class ParticleSystem extends ECS.System {
    private particles: CoreParticleSystem;
    private renderer: any;
    private presets: Record<ParticlePreset, ParticleEmitConfig>;
    public cameraX: number = 0;
    public cameraY: number = 0;

    constructor(renderer: any, images: ParticleImageMap) {
        super();
        this.renderer = renderer;
        this.particles = new CoreParticleSystem();
        this.presets   = buildPresets(images);
    }

    /** Emit particles at world-space position (x, y) using a named preset. */
    public emit(preset: ParticlePreset, x: number, y: number): void {
        this.particles.emit(this.presets[preset], x, y);
    }

    execute(delta: number): void {
        this.particles.update(delta);
        this.particles.draw(this.renderer, this.cameraX, this.cameraY);
    }
}
