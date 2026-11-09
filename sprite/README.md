# Sprite demo

Spritesheet animation with `Sprite` on a `Canvas2DRenderer`.

- Loads `images/spritesheet.png` with `AssetsManager.loadImage`.
- Cuts it into 214×282 frames, draws them at 107×140 and advances one frame every 1/25 s (driven by `RenderLoop.elapsed`).
- **Arrow keys** move the sprite.

## Run

```bash
npm install
npm run build:dev   # or build:prod — Grunt + webpack → dist/index.js
```

Serve this folder with any static file server and open `index.html`.

Art: Game Art Guppy (see `images/CREDITS.txt`).
