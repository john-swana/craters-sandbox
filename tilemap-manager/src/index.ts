import CRATERS from "craters"
const map2dTilemap = "./assets/tilemap.json";
(async function main() {
    const canvas2DRenderer = new CRATERS.WebGLRenderer(800, 668)
    const tilemapManager = new CRATERS.TilemapManager(canvas2DRenderer)
    const platformerTilemap = await tilemapManager.load(map2dTilemap)
    
    // Input setup
    const input = new CRATERS.Input();
    input.bind(CRATERS.Input.KEY.LEFT_ARROW, "LEFT");
    input.bind(CRATERS.Input.KEY.RIGHT_ARROW, "RIGHT");
    input.bind(CRATERS.Input.KEY.UP_ARROW, "UP");
    input.bind(CRATERS.Input.KEY.DOWN_ARROW, "DOWN");

    let camX = 0;
    let camY = 0;
    const speed = 5;

    const renderLoop = new CRATERS.RenderLoop(function(renderLoop: typeof CRATERS.RenderLoop) {
        if (input.isPressed("LEFT")) camX -= speed;
        if (input.isPressed("RIGHT")) camX += speed;
        if (input.isPressed("UP")) camY -= speed;
        if (input.isPressed("DOWN")) camY += speed;

        canvas2DRenderer.clear()
        // Pass negative camera position to simulate camera movement
        platformerTilemap.draw(-camX, -camY)
    })
    document.body.append(canvas2DRenderer.canvasElement)
})()