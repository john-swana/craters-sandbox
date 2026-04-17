import { EntityComponentSystem as ECS, SAT } from "craters";
const { Vector, Box } = SAT;
import { Position } from "./Position";

export class BoxCollider extends ECS.Component {
    width: number;
    height: number;
    constructor(width: number, height: number) {
        super();
        this.width = width;
        this.height = height;
    }
    getBox(pos: Position) {
        return new Box(new Vector(pos.x, pos.y), this.width, this.height);
    }
}
