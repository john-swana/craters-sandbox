import CRATERS from "craters"
(async function main() {
    const assetsManager = new CRATERS.AssetsManager()
    await assetsManager.loadImage("./images/spritesheet.png")
        .then(function(spritesheet) {
            const canvas2DRenderer = new CRATERS.WebGLRenderer(500, 500)
            const frames = [
                [0, 0],
                [0, 1],
                [0, 2],
                [1, 0],
                [1, 1],
            ]
            const sprite = new CRATERS.Sprite(canvas2DRenderer, spritesheet, 214, 282, frames, 1 / 25, 107, 140)
            
            // Input setup
            const input = new CRATERS.Input();
            input.bind(CRATERS.Input.KEY.LEFT_ARROW, "LEFT");
            input.bind(CRATERS.Input.KEY.RIGHT_ARROW, "RIGHT");
            input.bind(CRATERS.Input.KEY.UP_ARROW, "UP");
            input.bind(CRATERS.Input.KEY.DOWN_ARROW, "DOWN");

            let posX = 100;
            let posY = 100;
            const speed = 4;

            const renderLoop = new CRATERS.RenderLoop(function(renderLoop: any) {
                // Update Position
                if (input.isPressed("LEFT")) posX -= speed;
                if (input.isPressed("RIGHT")) posX += speed;
                if (input.isPressed("UP")) posY -= speed;
                if (input.isPressed("DOWN")) posY += speed;

                canvas2DRenderer.clear()
                sprite.draw(posX, posY, renderLoop)
            })
            document.body.append(canvas2DRenderer.canvasElement)
        })
        .catch(function(err) {
            throw err
        })
})()