import { EntityComponentSystem as ECS } from "craters";
export declare class PhysicsSystem extends ECS.System {
    private query;
    initialize(): void;
    execute(delta: number): void;
}
