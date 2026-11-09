# Tilemap Manager demo

Loading and drawing a tilemap with `TilemapManager` on a `WebGLRenderer`.

- Loads `assets/tilemap.json`, which uses Craters' own `map2d` format (each layer is a list of `[sourceCol, sourceRow, destCol, destRow, tilesetIndex]` entries). Tiled JSON exports are not supported.
- Draws every layer with `Tilemap.draw(offsetX, offsetY)`.
- **Arrow keys** pan the camera (the demo passes the negated camera position as the offset).

## Run

```bash
npm install
npm run build:dev   # or build:prod — Grunt + webpack → dist/index.js
```

Serve this folder with any static file server and open `index.html` (tileset image paths in the JSON resolve against the page URL).

Art: Kenney Platformer Pack, CC0 (see `images/CREDITS.txt`).
