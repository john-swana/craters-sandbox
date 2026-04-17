import { AssetsManager, Canvas2DRenderer, Sprite, Input, RenderLoop } from "craters"
(async function main() {
    const assetsManager = new AssetsManager()
    await assetsManager.loadImage("./images/spritesheet.png")
        .then(function (spritesheet) {
            const canvas2DRenderer = new Canvas2DRenderer(window.innerWidth, window.innerHeight)
            document.body.append(canvas2DRenderer.canvasElement)
            let _rsz: any;
            const _onResize = () => { clearTimeout(_rsz); _rsz = setTimeout(() => canvas2DRenderer.resize(window.innerWidth, window.innerHeight), 150); };
            window.addEventListener('resize', _onResize);
            window.addEventListener('orientationchange', _onResize);

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
            const frames = [
                [0, 0],
                [0, 1],
                [0, 2],
                [1, 0],
                [1, 1],
            ]
            const sprite = new Sprite(canvas2DRenderer, spritesheet, 214, 282, frames, 1 / 25, 107, 140)

            // Input setup
            const input = new Input();
            input.bind(Input.KEY.LEFT_ARROW, "LEFT");
            input.bind(Input.KEY.RIGHT_ARROW, "RIGHT");
            input.bind(Input.KEY.UP_ARROW, "UP");
            input.bind(Input.KEY.DOWN_ARROW, "DOWN");

            let posX = 296;
            let posY = 280;
            const speed = 4;

            const renderLoop = new RenderLoop(function (renderLoop: any) {
                // Update Position
                if (input.isPressed("LEFT")) posX -= speed;
                if (input.isPressed("RIGHT")) posX += speed;
                if (input.isPressed("UP")) posY -= speed;
                if (input.isPressed("DOWN")) posY += speed;

                canvas2DRenderer.clear()
                sprite.draw(posX, posY, renderLoop)
            })
        })
        .catch(function (err) {
            throw err
        })
})()