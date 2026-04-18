import { EntityComponentSystem as ECS, SAT } from "craters";
import { Position } from "./Position";
export declare class BoxCollider extends ECS.Component {
    width: number;
    height: number;
    constructor(width: number, height: number);
    getBox(pos: Position): SAT.Box;
}
