import { EntityComponentSystem as ECS } from "craters";

export class Crate extends ECS.Component {
    mass: number;
    constructor(mass = 1) {
        super();
        this.mass = mass;
    }
}
