import { EntityComponentSystem as ECS } from "craters";

export class Collectible extends ECS.Component {
    value: number;
    constructor(value = 10) {
        super();
        this.value = value;
    }
}
