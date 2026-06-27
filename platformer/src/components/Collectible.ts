import { EntityComponentSystem as ECS } from "craters";

export type ItemType = 'coin' | 'gem' | '1up' | 'star';

export class Collectible extends ECS.Component {
    value: number;
    itemType: ItemType;
    phase: number;  // bob/spin animation phase (radians)
    constructor(value = 10, itemType: ItemType = 'coin') {
        super();
        this.value = value;
        this.itemType = itemType;
        this.phase = Math.random() * Math.PI * 2;
    }
}
