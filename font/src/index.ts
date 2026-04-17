import { AssetsManager, Canvas2DRenderer, FontManager, Input, RenderLoop } from "craters"
const text: string = `MIT License

Copyright (c) 2019 JOHN SWANA

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
(async function main() {
    const assetsManager = new AssetsManager()

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

    await assetsManager.loadFont("Pixel font", "url(\"./fonts/Kenney Pixel.ttf\") format(\"truetype\")")
        .then(function (font) {
            (document as any).fonts.add(font)
        })
        .then(async function () {
            const canvas2DRenderer = new Canvas2DRenderer(window.innerWidth, window.innerHeight)
            document.body.append(canvas2DRenderer.canvasElement)
            let _rsz: any;
            const _onResize = () => { clearTimeout(_rsz); _rsz = setTimeout(() => canvas2DRenderer.resize(window.innerWidth, window.innerHeight), 150); };
            window.addEventListener('resize', _onResize);
            window.addEventListener('orientationchange', _onResize);
            const fontManager = new FontManager(canvas2DRenderer, "20px Pixel font", "#fafafa")

            // Load fonts
            var fontLicense = fontManager.load(text)
            var fontTitle = fontManager.load("PRESS ENTER TO START")

            const input = new Input();
            input.bind(Input.KEY.ENTER, "START");

            let showTitle = true;

            const renderLoop = new RenderLoop(function (renderLoop: typeof RenderLoop) {
                if (input.isPressed("START") === 2) {
                    showTitle = !showTitle;
                }

                canvas2DRenderer.clear();

                if (showTitle) {
                    if (Math.floor(Date.now() / 500) % 2 === 0) {
                        // Measure text width so we can centre it at any screen size
                        canvas2DRenderer.context.font = "20px Pixel font";
                        const tw = canvas2DRenderer.context.measureText("PRESS ENTER TO START").width;
                        const tx = (window.innerWidth - tw) / 2;
                        const ty = window.innerHeight / 2;
                        fontTitle.draw("PRESS ENTER TO START", tx, ty);
                    }
                } else {
                    const margin = 20;
                    const lineHeight = 40 * 0.75;
                    text.split("\n")
                        .map((line: string, ln: number) =>
                            fontLicense.draw(line, margin, margin + lineHeight * ln)
                        );
                }
            })

        })
        .catch(function (err) {
            throw err
        })
})()