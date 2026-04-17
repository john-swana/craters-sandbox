import { EntityComponentSystem as ECS } from "craters";

export class Acceleration extends ECS.Component {
    x: number;
    y: number;
    constructor(x: number = 0, y: number = 0) {
        super();
        this.x = x;
        this.y = y;
    }
}
