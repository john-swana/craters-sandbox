import { EntityComponentSystem as ECS } from "craters";
export declare class CollisionSystem extends ECS.System {
    sounds: any;
    score: number;
    onScoreChange: (score: number) => void;
    constructor(sounds: any, onScoreChange: (score: number) => void);
    execute(delta: number): void;
}
