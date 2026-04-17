import { EntityComponentSystem as ECS, SAT } from "craters";

export class RigidBody extends ECS.Component {
    body: SAT.RigidBody;

    constructor(mass: number = 1, friction: number = 0.1, restitution: number = 0.1) {
        super();
        this.body = new SAT.RigidBody(new SAT.Vector(), mass, restitution, friction);
        this.body.linearDamping = 1.0; // Disable damping to prevent "floaty" feel and low jumps
    }
}
