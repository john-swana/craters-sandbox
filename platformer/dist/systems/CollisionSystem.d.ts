import { EntityComponentSystem as ECS } from "craters";
import { ParticleSystem } from "./ParticleSystem";
export declare class CollisionSystem extends ECS.System {
    sounds: any;
    score: number;
    onScoreChange: (score: number) => void;
    particles: ParticleSystem | null;
    private collidersQuery;
    private playerQuery;
    private enemyQuery;
    private projQuery;
    private portalQuery;
    constructor(sounds: any, onScoreChange: (score: number) => void, particles?: ParticleSystem);
    private playSound;
    initialize(): void;
    execute(_delta: number): void;
}
