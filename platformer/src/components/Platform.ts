import { EntityComponentSystem as ECS } from "craters";

export class Platform extends ECS.Component {
    color: string;
    constructor(color = '#8B4513') {
        super();
        this.color = color;
    }
}
