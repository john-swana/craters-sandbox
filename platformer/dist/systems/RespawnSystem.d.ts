import { EntityComponentSystem as ECS } from "craters";
export declare class RespawnSystem extends ECS.System {
    private query;
    initialize(): void;
    execute(_delta: number): void;
}
