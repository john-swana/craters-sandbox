import { EntityComponentSystem as ECS } from "craters";

export type EnemyType = 'spider' | 'bee';

export class Enemy extends ECS.Component {
    type:            EnemyType;
    speed:           number;
    direction:       number;    // 1 = right, -1 = left
    patrolLeft:      number;    // world-X left bound
    patrolRight:     number;    // world-X right bound
    dead:            boolean;
    deadFrames:      number;    // countdown after death before entity removal
    floatPhase:      number;    // bee only — current sin phase (radians)
    floatAmp:        number;    // bee only — vertical oscillation amplitude (px)
    baseY:           number;    // bee only — vertical centre of the oscillation
    reverseCooldown: number;    // frames to ignore obstacle check after a reversal

    constructor(
        type: EnemyType,
        patrolLeft: number,
        patrolRight: number,
        speed = 1.5,
        floatAmp = 30,
    ) {
        super();
        this.type            = type;
        this.speed           = speed;
        this.direction       = 1;
        this.patrolLeft      = patrolLeft;
        this.patrolRight     = patrolRight;
        this.dead            = false;
        this.deadFrames      = 0;
        this.floatPhase      = Math.random() * Math.PI * 2;
        this.floatAmp        = floatAmp;
        this.baseY           = 0;
        this.reverseCooldown = 0;
    }
}
