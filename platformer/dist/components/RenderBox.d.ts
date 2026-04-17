import { EntityComponentSystem as ECS } from "craters";
export declare class RenderBox extends ECS.Component {
    color: string;
    fill: boolean;
    constructor(color: string, fill?: boolean);
}
