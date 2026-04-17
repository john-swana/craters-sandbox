import { EntityComponentSystem as ECS } from "craters";

export class RenderBox extends ECS.Component {
    color: string;
    fill: boolean;
    constructor(color: string, fill = true) {
        super();
        this.color = color;
        this.fill = fill;
    }
}
