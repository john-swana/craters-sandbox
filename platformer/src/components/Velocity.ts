import { EntityComponentSystem as ECS } from "craters";

export class Velocity extends ECS.Component {
    x: number;
    y: number;
    constructor(x: number, y: number) {
        super();
        this.x = x;
        this.y = y;
    }
}
