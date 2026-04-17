import { EntityComponentSystem as ECS } from "craters";

export class Position extends ECS.Component {
    x: number;
    y: number;
    constructor(x: number, y: number) {
        super();
        this.x = x;
        this.y = y;
    }
}
