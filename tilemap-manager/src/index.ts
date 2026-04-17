import { WebGLRenderer, TilemapManager, Input, RenderLoop } from "craters"
const map2dTilemap = "./assets/tilemap.json";
(async function main() {
    const canvas2DRenderer = new WebGLRenderer(window.innerWidth, window.innerHeight)
    document.body.append(canvas2DRenderer.canvasElement)
    let _rsz: any;
const _onResize = () => { clearTimeout(_rsz); _rsz = setTimeout(() => canvas2DRenderer.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio), 150); };
window.addEventListener('resize', _onResize);
window.addEventListener('orientationchange', _onResize);
    const tilemapManager = new TilemapManager(canvas2DRenderer)
    const platformerTilemap = await tilemapManager.load(map2dTilemap)

    // UI Elements
    const collapseBtn = document.getElementById('collapse-overlay') as HTMLButtonElement;
    const uiOverlay = document.getElementById('ui-overlay') as HTMLDivElement;

    // Collapse button logic
    if (collapseBtn && uiOverlay) {
        collapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            uiOverlay.classList.toggle('collapsed');
            if (uiOverlay.classList.contains('collapsed')) {
                collapseBtn.textContent = '+';
                collapseBtn.title = "Expand Panel";
            } else {
                collapseBtn.textContent = '_';
                collapseBtn.title = "Collapse Panel";
            }
        });
        uiOverlay.addEventListener('click', (e) => {
            if (uiOverlay.classList.contains('collapsed') && e.target !== collapseBtn) {
                uiOverlay.classList.remove('collapsed');
                collapseBtn.textContent = '_';
                collapseBtn.title = "Collapse Panel";
            }
        });
    }
    // Input setup
    const input = new Input();
    input.bind(Input.KEY.LEFT_ARROW, "LEFT");
    input.bind(Input.KEY.RIGHT_ARROW, "RIGHT");
    input.bind(Input.KEY.UP_ARROW, "UP");
    input.bind(Input.KEY.DOWN_ARROW, "DOWN");

    let camX = 0;
    let camY = 0;
    const speed = 5;

    const renderLoop = new RenderLoop(function (renderLoop: typeof RenderLoop) {
        if (input.isPressed("LEFT")) camX -= speed;
        if (input.isPressed("RIGHT")) camX += speed;
        if (input.isPressed("UP")) camY -= speed;
        if (input.isPressed("DOWN")) camY += speed;

        canvas2DRenderer.clear()
        // Pass negative camera position to simulate camera movement
        platformerTilemap.draw(-camX, -camY)
    })

})()