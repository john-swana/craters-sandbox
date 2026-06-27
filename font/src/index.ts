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
    const assetsManager = new AssetsManager();

    // UI Elements
    const collapseBtn = document.getElementById('collapse-overlay') as HTMLButtonElement;
    const uiOverlay   = document.getElementById('ui-overlay') as HTMLDivElement;

    if (collapseBtn && uiOverlay) {
        collapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            uiOverlay.classList.toggle('collapsed');
            collapseBtn.textContent = uiOverlay.classList.contains('collapsed') ? '+' : '_';
            collapseBtn.title = uiOverlay.classList.contains('collapsed') ? 'Expand Panel' : 'Collapse Panel';
        });
        uiOverlay.addEventListener('click', (e) => {
            if (uiOverlay.classList.contains('collapsed') && e.target !== collapseBtn) {
                uiOverlay.classList.remove('collapsed');
                collapseBtn.textContent = '_';
                collapseBtn.title = 'Collapse Panel';
            }
        });
    }

    // ── Recommended font loading pattern ────────────────────────────────────
    // Step 1: register the FontFace with the document.
    const font = await assetsManager.loadFont(
        "Pixel font",
        "url(\"./fonts/Kenney Pixel.ttf\") format(\"truetype\")"
    );
    (document as any).fonts.add(font);

    // Step 2: await document.fonts.load() so the font is FULLY decoded in the
    // browser's rendering pipeline before FontManager.load() measures and bakes
    // each character into the atlas.
    //
    // Skipping this step causes measureText() to silently fall back to the
    // system font on the first call (especially on mobile / high-DPR screens),
    // producing incorrect character widths → atlas misalignment → clipping and
    // neighbouring-sprite bleed.
    await document.fonts.load("20px Pixel font");

    // Step 3: safe to create the renderer and bake the font atlas now.
    const canvas2DRenderer = new Canvas2DRenderer(window.innerWidth, window.innerHeight);
    document.body.append(canvas2DRenderer.canvasElement);

    let _rsz: any;
    const _onResize = () => {
        clearTimeout(_rsz);
        _rsz = setTimeout(() => canvas2DRenderer.resize(window.innerWidth, window.innerHeight), 150);
    };
    window.addEventListener('resize', _onResize);
    window.addEventListener('orientationchange', _onResize);

    const fontManager = new FontManager(canvas2DRenderer, "20px Pixel font", "#fafafa");
    const fontLicense = fontManager.load(text);
    const fontTitle   = fontManager.load("PRESS ENTER TO START");

    const input = new Input();
    input.bind(Input.KEY.ENTER, "START");

    let showTitle = true;

    new RenderLoop(function () {
        if (input.isPressed("START") === 2) showTitle = !showTitle;

        canvas2DRenderer.clear();

        if (showTitle) {
            if (Math.floor(Date.now() / 500) % 2 === 0) {
                canvas2DRenderer.context.font = "20px Pixel font";
                const tw = canvas2DRenderer.context.measureText("PRESS ENTER TO START").width;
                fontTitle.draw("PRESS ENTER TO START", (window.innerWidth - tw) / 2, window.innerHeight / 2);
            }
        } else {
            const margin = 20;
            const lineHeight = 40 * 0.75;
            text.split("\n").forEach((line: string, ln: number) => {
                fontLicense.draw(line, margin, margin + lineHeight * ln);
            });
        }

        // Advance input edge state once per frame (collapses "just pressed" → "held").
        input.update();
    });
})();