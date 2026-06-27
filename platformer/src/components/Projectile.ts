import { EntityComponentSystem as ECS } from "craters";

/** Spark projectile fired by the player (J / X key). */
export class Projectile extends ECS.Component {
    life: number;   // frames remaining
    dir: number;    // +1 right, -1 left
    spin: number;   // rotation angle in radians
    constructor(dir: number) {
        super();
        this.life = 40;
        this.dir  = dir;
        this.spin = 0;
    }
}
