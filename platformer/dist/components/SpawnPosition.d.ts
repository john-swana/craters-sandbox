import { EntityComponentSystem as ECS } from "craters";
export declare class SpawnPosition extends ECS.Component {
    x: number;
    y: number;
    constructor(x: number, y: number);
}
