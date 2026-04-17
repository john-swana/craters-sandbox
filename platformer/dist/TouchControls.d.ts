export declare class TouchControls {
    leftPressed: boolean;
    rightPressed: boolean;
    jumpPressed: boolean;
    constructor();
    checkTouchSupport(): void;
    setupListeners(): void;
    bindButton(element: HTMLElement | null, callback: (pressed: boolean) => void): void;
    isPressed(action: string): boolean;
}
