import { EntityComponentSystem as ECS } from "craters";
export declare class Collectible extends ECS.Component {
    value: number;
    constructor(value?: number);
}
