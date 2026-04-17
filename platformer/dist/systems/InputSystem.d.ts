import { EntityComponentSystem as ECS } from "craters";
export declare class InputSystem extends ECS.System {
    input: any;
    sounds: any;
    constructor(input: any, sounds: any);
    execute(delta: number): void;
}
