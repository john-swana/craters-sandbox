import { EntityComponentSystem as ECS } from "craters";
import { ParticleSystem } from "./ParticleSystem";
export declare class InputSystem extends ECS.System {
    input: any;
    sounds: any;
    particles: ParticleSystem | null;
    private runPuffTimer;
    private playSound;
    private playerQuery;
    private projQuery;
    constructor(input: any, sounds: any, particles?: ParticleSystem);
    initialize(): void;
    execute(delta: number): void;
}
