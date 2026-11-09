# Font demo

Bitmap text rendering with `FontManager` on a `Canvas2DRenderer`.

- Loads `fonts/Kenney Pixel.ttf` with `AssetsManager.loadFont` (the second argument is a CSS `src` value, `url("…") format("truetype")`), then waits for `document.fonts.load()` before baking the glyph atlas.
- Renders the MIT license text and a "PRESS ENTER TO START" title with `FontManager.load()` / `draw()`.
- **Enter** toggles the title.

## Run

```bash
npm install
npm run build:dev   # or build:prod — Grunt + webpack → dist/index.js
```

Serve this folder with any static file server and open `index.html`.

Fonts: Kenney Fonts, CC0 (see `fonts/License.txt`).
