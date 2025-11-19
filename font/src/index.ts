import CRATERS from "craters"
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
    const assetsManager = new CRATERS.AssetsManager()
    await assetsManager.loadFont("Pixel font", "url(\"./fonts/Kenney Pixel.ttf\") format(\"truetype\")")
        .then(function(font) {
            (document as any).fonts.add(font)
        })
        .then(async function() {
            const canvas2DRenderer = new CRATERS.WebGLRenderer(1000, 700)
            const fontManager = new CRATERS.FontManager(canvas2DRenderer, "40px Pixel font", "#fafafa")
            
            // Load fonts
            var fontLicense = fontManager.load(text)
            var fontTitle = fontManager.load("PRESS ENTER TO START")

            const input = new CRATERS.Input();
            input.bind(CRATERS.Input.KEY.ENTER, "START");
            
            let showTitle = true;

            const renderLoop = new CRATERS.RenderLoop(function(renderLoop: typeof CRATERS.RenderLoop) {
                if (input.isPressed("START") === 2) { // 2 = Just Pressed
                    showTitle = !showTitle;
                }

                canvas2DRenderer.clear()
                
                if (showTitle) {
                    if (Math.floor(Date.now() / 500) % 2 === 0) {
                        fontTitle.draw("PRESS ENTER TO START", 300, 300);
                    }
                } else {
                    // split into chunks
                    text.split("\n")
                        // draw at line number x (75% height)
                        .map((line: string, ln: number) => fontLicense.draw(line, 10, (40 * .75) * ln))
                }
            })
            document.body.append(canvas2DRenderer.canvasElement)
        })
        .catch(function(err) {
            throw err
        })
})()