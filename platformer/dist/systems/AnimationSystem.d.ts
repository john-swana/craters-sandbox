import { EntityComponentSystem as ECS } from "craters";
export declare class AnimationSystem extends ECS.System {
    private query;
    initialize(): void;
    execute(delta: number): void;
}
