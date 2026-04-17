export declare class Game {
    renderer: any;
    input: any;
    world: any;
    fontSmall: any;
    fontMedium: any;
    fontLarge: any;
    sounds: any;
    music: any;
    score: number;
    loop: any;
    cameraX: number;
    cameraY: number;
    constructor();
    bindInput(): void;
    init(): Promise<void>;
    loadResources(): Promise<void>;
    setupSystems(): void;
    buildLevel(data: any, tilesetImage: HTMLImageElement, playerImage: HTMLImageElement, coinImage: HTMLImageElement): void;
    startGame(): void;
}
