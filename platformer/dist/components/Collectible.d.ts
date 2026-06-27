import { EntityComponentSystem as ECS } from "craters";
export type ItemType = 'coin' | 'gem' | '1up' | 'star';
export declare class Collectible extends ECS.Component {
    value: number;
    itemType: ItemType;
    phase: number;
    constructor(value?: number, itemType?: ItemType);
}
