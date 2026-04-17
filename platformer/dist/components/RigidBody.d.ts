import { EntityComponentSystem as ECS, SAT } from "craters";
export declare class RigidBody extends ECS.Component {
    body: SAT.RigidBody;
    constructor(mass?: number, friction?: number, restitution?: number);
}
