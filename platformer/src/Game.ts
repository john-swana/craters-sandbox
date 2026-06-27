import { EntityComponentSystem as ECS, Canvas2DRenderer, Input, RenderLoop, FontManager, SoundManager, AssetsManager } from "craters";
import { Position } from "./components/Position";
import { Velocity } from "./components/Velocity";
import { BoxCollider } from "./components/BoxCollider";
import { Player } from "./components/Player";
import { Platform } from "./components/Platform";
import { Collectible } from "./components/Collectible";
import { TileRender } from "./components/TileRender";
import { SpriteRender } from "./components/SpriteRender";
import { Enemy } from "./components/Enemy";
import { InputSystem } from "./systems/InputSystem";
import { AnimationSystem } from "./systems/AnimationSystem";
import { PhysicsSystem } from "./systems/PhysicsSystem";
import { CollisionSystem } from "./systems/CollisionSystem";
import { RenderSystem } from "./systems/RenderSystem";
import { EnemySystem } from "./systems/EnemySystem";
import { RigidBody } from "./components/RigidBody";
import { SpawnPosition } from "./components/SpawnPosition";
import { RespawnSystem } from "./systems/RespawnSystem";
import { ParticleSystem } from "./systems/ParticleSystem";
import { Portal } from "./components/Portal";

// ── Float-text system ─────────────────────────────────────────────────────────
interface FloatText { x: number; y: number; text: string; color: string; life: number; }

export class Game {
    gameState: 'start' | 'playing' | 'paused' | 'gameover' | 'victory';
    private _tilemapData: any;
    private _tilesetImage: any;
    private _playerImage: any;
    private _enemyImage: any;
    private _kenneyBackgrounds: HTMLImageElement | null = null;

    renderer: any;
    input: any;
    world: any;
    // Cached once in setupSystems() for the HOT per-frame uses (the playing-loop
    // coin-bob iteration and the HUD remaining-coin count). Creating a query per
    // frame instead would leak it permanently into world.queries and slow every
    // entity add/remove without bound. One-off counts (game over / victory / menu)
    // use world.queryOnce(), which matches without registering anything.
    private collectibleQuery!: ECS.Query;
    fontSmall: any;
    fontMedium: any;
    fontLarge: any;
    sounds: any;
    music: any;
    score: number;
    particleImages: any;
    loop: any;
    cameraX: number;
    cameraY: number;
    private _loadingProgress: number = 0;
    private _loadingRafId: number = 0;

    // Float-text array
    private floats: FloatText[] = [];

    // Timer
    private timer: number = 200;

    // Mute state
    private muted: boolean = false;

    // Canvas element (inside #frame)
    private canvas: HTMLCanvasElement | null = null;

    constructor() {
        // Renderer creates its own canvas—mount it inside #frame, replacing the placeholder
        this.renderer = new Canvas2DRenderer(960, 528, {}, 1);
        const frame = document.getElementById('frame');
        const placeholder = document.getElementById('game-canvas');
        if (frame && placeholder) {
            frame.insertBefore(this.renderer.canvasElement, placeholder);
            placeholder.remove();
        } else if (frame) {
            frame.prepend(this.renderer.canvasElement);
        } else {
            document.body.appendChild(this.renderer.canvasElement);
        }
        this.renderer.canvasElement.id = 'game-canvas';
        this.renderer.canvasElement.style.width  = '100%';
        this.renderer.canvasElement.style.height = '100%';
        this.renderer.canvasElement.style.display = 'block';
        this.renderer.canvasElement.style.imageRendering = 'pixelated';
        this.canvas = this.renderer.canvasElement;

        // Keep canvas sharp when DPR changes (e.g. moving window between displays).
        window.addEventListener('resize', () => {
            this.renderer.resize(960, 528);
            this.renderer.canvasElement.style.width  = '100%';
            this.renderer.canvasElement.style.height = '100%';
        });

        this.input = new Input();
        this.bindInput();

        this.world = new ECS.World();
        this.sounds = {};
        this.score = 0;
        this.cameraX = 480  - 140;
        this.cameraY = 264  - 962;



        // Register float-text global so CollisionSystem can post floats
        (window as any).addFloat = (x: number, y: number, text: string, color: string) => {
            this.floats.push({ x, y, text, color, life: 1 });
        };
        (window as any).add1up = () => {
            const player = (window as any).gamePlayer;
            if (player) {
                const pc = player.getComponent(Player);
                if (pc) { pc.lives = Math.min(pc.lives + 1, pc.maxLives); }
            }
        };

        // Wire up HTML overlay buttons
        this._wireOverlayButtons();

        (window as any).gameInstance = this;
        (window as any).showDebug = false;
    }

    // ── HTML overlay wiring ───────────────────────────────────────────────────

    // Swap the top pause/play button icon (companion to the mute toggle):
    // shows "play" while paused, "pause" otherwise.
    private _setPauseIcon(paused: boolean) {
        const img = document.querySelector('#btn-pause img') as HTMLImageElement;
        if (img) img.src = paused
            ? './assets/icons/icon_play.png'
            : './assets/icons/icon_pause.png';
    }

    private _showOverlay(id: string) {
        ['ov-title','ov-pause','ov-win','ov-over'].forEach(oid => {
            document.getElementById(oid)?.classList.toggle('hidden', oid !== id);
        });
        this._setPauseIcon(id === 'ov-pause');
    }
    private _hideOverlays() {
        ['ov-title','ov-pause','ov-win','ov-over'].forEach(oid => {
            document.getElementById(oid)?.classList.add('hidden');
        });
        this._setPauseIcon(false);
    }

    private _wireOverlayButtons() {
        const bindButtonTouch = (id: string, callback: () => void, isBackAction = false) => {
            const el = document.getElementById(id);
            if (!el) return;
            const handler = (e: Event) => {
                e.preventDefault();
                e.stopPropagation();
                this.music?.resume();
                if (!this.muted) {
                    if (isBackAction) {
                        this.sounds.menuBack?.play();
                    } else {
                        this.sounds.menuValid?.play();
                    }
                }
                callback();
            };
            el.addEventListener('touchstart', handler, { passive: false });
            el.addEventListener('mousedown',  handler);
        };

        bindButtonTouch('btn-start', () => {
            this._hideOverlays();
            this.gameState = 'playing';
        });
        bindButtonTouch('btn-resume', () => {
            this._hideOverlays();
            this.gameState = 'playing';
        });
        bindButtonTouch('btn-restart-p', () => this.resetGame());
        bindButtonTouch('btn-again',     () => this.resetGame());
        bindButtonTouch('btn-retry',     () => this.resetGame());
        bindButtonTouch('btn-pause',     () => this._togglePause(), true);
        bindButtonTouch('btn-mute',      () => this._toggleMute(), true);

        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') e.preventDefault();
            if (e.key === 'Escape' || e.code === 'KeyP') {
                if (!this.muted) this.sounds.menuBack?.play();
                if (this.gameState === 'playing')      this._togglePause();
                else if (this.gameState === 'paused')  this._togglePause();
            }
            if (e.code === 'KeyM') {
                if (!this.muted) this.sounds.menuBack?.play();
                this._toggleMute();
            }
            if (e.code === 'KeyR' && (this.gameState === 'paused' || this.gameState === 'gameover' || this.gameState === 'victory')) {
                if (!this.muted) this.sounds.menuValid?.play();
                this.resetGame();
            }
            if ((e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'KeyJ') && this.gameState === 'start') {
                this._hideOverlays(); this.gameState = 'playing';
            }
            if ((e.code === 'Space' || e.code === 'Enter') && (this.gameState === 'gameover' || this.gameState === 'victory')) {
                this.resetGame();
            }
            if (e.key === 'F2') (window as any).showDebug = !(window as any).showDebug;
        });

        // Canvas click: start / unpause / retry
        // Note: do NOT stopPropagation — overlay buttons are z-index above the canvas and
        // need their own events. Only act if the target is actually the canvas itself.
        const handleCanvasAction = (e: Event) => {
            if ((e.target as Element)?.closest('.btn, .iconbtn')) return; // let button handlers fire
            e.preventDefault();
            this.music?.resume();
            if (this.gameState === 'start')   { this._hideOverlays(); this.gameState = 'playing'; }
            else if (this.gameState === 'paused')  { this._hideOverlays(); this.gameState = 'playing'; }
            else if (this.gameState === 'gameover' || this.gameState === 'victory') { this.resetGame(); }
        };
        this.canvas?.addEventListener('touchstart', handleCanvasAction, { passive: false });
        this.canvas?.addEventListener('mousedown',  handleCanvasAction);

        // Mobile touch pad: simulate actual keyboard events to be minification-proof and robust
        const sendKey = (code: string, isDown: boolean) => {
            const event = new KeyboardEvent(isDown ? 'keydown' : 'keyup', {
                code: code,
                bubbles: true,
                cancelable: true
            });
            document.dispatchEvent(event);
        };
        const bindTouch = (id: string, keyCode: string) => {
            const el = document.getElementById(id);
            if (!el) return;
            const onStart = (e: Event) => {
                e.preventDefault();
                this.music?.resume();
                sendKey(keyCode, true);
            };
            const onEnd   = (e: Event) => {
                e.preventDefault();
                sendKey(keyCode, false);
            };
            el.addEventListener('touchstart', onStart, { passive: false });
            el.addEventListener('touchend',   onEnd,   { passive: false });
            el.addEventListener('touchcancel',onEnd,   { passive: false });
            el.addEventListener('mousedown',  onStart);
            el.addEventListener('mouseup',    onEnd);
            el.addEventListener('mouseleave', onEnd);
        };
        bindTouch('t-left',  'ArrowLeft');
        bindTouch('t-right', 'ArrowRight');
        bindTouch('t-jump',  'Space');
        bindTouch('t-shoot', 'KeyJ');

        if ('ontouchstart' in window || navigator.maxTouchPoints > 0) {
            document.getElementById('touch')?.classList.add('show');
        }
    }

    private _togglePause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            this._showOverlay('ov-pause');
        } else if (this.gameState === 'paused') {
            this._hideOverlays();
            this.gameState = 'playing';
        }
    }

    private _toggleMute() {
        this.muted = !this.muted;
        const img = document.querySelector('#btn-mute img') as HTMLImageElement;
        if (img) {
            img.src = this.muted ? './assets/icons/icon_sound_disabled.png' : './assets/icons/icon_sound.png';
        }
        this.music?.setVolume(this.muted ? 0 : 0.2);
    }

    bindInput() {
        this.input.bind("ArrowLeft",  "MOVE_LEFT");
        this.input.bind("KeyA",       "MOVE_LEFT");
        this.input.bind("ArrowRight", "MOVE_RIGHT");
        this.input.bind("KeyD",       "MOVE_RIGHT");
        this.input.bind("Space",      "JUMP");
        this.input.bind("ArrowUp",    "JUMP");
        this.input.bind("KeyW",       "JUMP");
        this.input.bind("ShiftLeft",  "DASH");
        this.input.bind("ShiftRight", "DASH");
        this.input.bind("KeyJ",       "SHOOT");
        this.input.bind("KeyX",       "SHOOT");
    }

    async init() {
        await Promise.all([
            document.fonts.load('48px GameFont'),
            document.fonts.load('48px KenneyFuture'),
            document.fonts.load('48px KenneyFutureNarrow')
        ]);
        this._startLoadingScreen();
        await this.loadResources();
        this._loadingProgress = 1;
        await new Promise(r => setTimeout(r, 400));
        this._stopLoadingScreen();
        this.setupSystems();

        this.gameState = 'start';
        this._showOverlay('ov-title');
        this.startGame();
    }

    gameOver() {
        this.gameState = 'gameover';
        if (this.sounds.death && !this.muted) {
            this.sounds.death.play();
        }
        const card = document.getElementById('over-card');
        if (card) card.innerHTML =
            `SCORE&nbsp;&nbsp;<span class="v">${String(this.score).padStart(6, '0')}</span>`;
        this._showOverlay('ov-over');
    }

    victory() {
        this.gameState = 'victory';
        if (this.sounds.menuValid && !this.muted) {
            this.sounds.menuValid.play();
        }
        // Still award the time bonus (gameplay reward), just don't break it out.
        this.score += Math.ceil(this.timer) * 10;
        const card = document.getElementById('win-card');
        if (card) card.innerHTML =
            `SCORE&nbsp;&nbsp;<span class="v">${String(this.score).padStart(6, '0')}</span>`;
        this._showOverlay('ov-win');
    }

    resetGame() {
        this.score  = 0;
        this.timer  = 200;
        this.floats = [];
        (window as any).gameTime = 0;

        const allEntities = [...this.world.entities];
        allEntities.forEach((entity: any) => this.world.removeEntity(entity));

        this.buildLevel(this._tilemapData, this._tilesetImage, this._playerImage, this._enemyImage);

        this.cameraX = -140 + 480;
        this.cameraY = -962 + 264;

        this._hideOverlays();
        this.gameState = 'playing';
    }

    // ── Loading screen ────────────────────────────────────────────────────────

    private _startLoadingScreen(): void {
        const tick = () => {
            this._loadingRafId = requestAnimationFrame(tick);
            this._drawLoadingScreen();
        };
        this._loadingRafId = requestAnimationFrame(tick);
    }
    private _stopLoadingScreen(): void {
        cancelAnimationFrame(this._loadingRafId);
        this._loadingRafId = 0;
    }
    private _drawLoadingScreen(): void {
        const ctx = this.renderer.context;
        const w = 960, h = 528;
        // Solid dark background — matches the page theme (--bg / --gold / --edge).
        ctx.fillStyle = '#0b0814';
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '56px "KenneyFuture", GameFont, monospace';
        ctx.fillStyle = '#120e26'; ctx.fillText('CRATERS', w / 2, h * 0.42 + 3); // drop shadow
        ctx.fillStyle = '#ffd23f'; ctx.fillText('CRATERS', w / 2, h * 0.42);
        ctx.font = '15px "KenneyFutureNarrow", GameFont, monospace';
        ctx.fillStyle = '#fff4d6'; ctx.fillText('A D V E N T U R E', w / 2, h * 0.42 + 46);

        // Minimal progress bar: panel track, gold fill, dark border.
        const barW = 360, barH = 12, barX = (w - barW) / 2, barY = h * 0.62;
        ctx.fillStyle = '#241a3a'; ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = '#ffd23f'; ctx.fillRect(barX, barY, Math.round(this._loadingProgress * barW), barH);
        ctx.strokeStyle = '#120e26'; ctx.lineWidth = 2; ctx.strokeRect(barX, barY, barW, barH);
    }

    async loadResources() {
        try {
            const assets = new AssetsManager();
            const TOTAL = 27; let loaded = 0;
            // Advances the loading-bar progress as each asset resolves.
            const track = <T>(p: Promise<T>): Promise<T> =>
                p.then(v => { loaded++; this._loadingProgress = loaded / TOTAL; return v; });

            const [
                tilemapData, tilesetImage, playerImage, enemyImage, kenneyBackgrounds,
                pDirt01, pDirt02, pStar04, pStar07, pSpark06, pCircle05, pSpark07, pSmoke03, pSmoke06,
            ] = await Promise.all([
                track(assets.loadJson('./assets/tilemap.json')),
                track(assets.loadImage('./assets/kenney/tiles.png')),
                track(assets.loadImage('./assets/kenney/characters.png')),
                track(assets.loadImage('./assets/kenney/enemies.png')),
                track(assets.loadImage('./assets/kenney/backgrounds.png')),
                track(assets.loadImage('./assets/particles/dirt_01.png')),
                track(assets.loadImage('./assets/particles/dirt_02.png')),
                track(assets.loadImage('./assets/particles/star_04.png')),
                track(assets.loadImage('./assets/particles/star_07.png')),
                track(assets.loadImage('./assets/particles/spark_06.png')),
                track(assets.loadImage('./assets/particles/circle_05.png')),
                track(assets.loadImage('./assets/particles/spark_07.png')),
                track(assets.loadImage('./assets/particles/smoke_03.png')),
                track(assets.loadImage('./assets/particles/smoke_06.png')),
            ]);

            this._kenneyBackgrounds = kenneyBackgrounds as HTMLImageElement;

            this.particleImages = {
                dust:        [pDirt01, pDirt02],
                coin_collect:[pStar04, pStar07, pSpark06],
                jump_burst:  [pCircle05, pSpark07],
                run_puff:    [pSmoke03, pSmoke06],
            };

            const fontManagerSmall = new FontManager(this.renderer, "16px GameFont", "#ffffff");
            this.fontSmall = fontManagerSmall.load("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:!., ");
            const fontManagerMedium = new FontManager(this.renderer, "24px GameFont", "#ffffff");
            this.fontMedium = fontManagerMedium.load("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:!., ");
            const fontManagerLarge = new FontManager(this.renderer, "48px GameFont", "#ffffff");
            this.fontLarge = fontManagerLarge.load("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:!., ");

            const soundManager = new SoundManager();
            // SFX from the Kenney New Platformer Pack (./assets/kenney/sounds).
            // Music has no pack equivalent, so it stays as the existing track.
            const S = './assets/kenney/sounds/';
            const [
                jumpSound, jumpHighSound, landSound, pickupSound, gemSound, hurtSound, musicSound,
                shootSound, enemyDieSound, fallSound, deathSound, menuValidSound, menuBackSound
            ] = await Promise.all([
                track(soundManager.load(S + 'sfx_jump.ogg')),       // jump
                track(soundManager.load(S + 'sfx_jump-high.ogg')),  // double jump
                track(soundManager.load(S + 'sfx_bump.ogg')),       // land
                track(soundManager.load(S + 'sfx_coin.ogg')),       // coin pickup
                track(soundManager.load(S + 'sfx_gem.ogg')),        // gem / 1up pickup
                track(soundManager.load(S + 'sfx_hurt.ogg')),       // hurt
                track(soundManager.load('./assets/audio/music.wav')), // music
                track(soundManager.load(S + 'sfx_throw.ogg')),      // spark shot
                track(soundManager.load(S + 'sfx_disappear.ogg')),  // enemy death
                track(soundManager.load(S + 'sfx_disappear.ogg')),  // fall off level
                track(soundManager.load(S + 'sfx_magic.ogg')),      // game over
                track(soundManager.load(S + 'sfx_select.ogg')),     // menu confirm
                track(soundManager.load(S + 'sfx_bump.ogg')),       // menu back
            ]);
            this.sounds.jump      = jumpSound;
            this.sounds.jumpHigh  = jumpHighSound;
            this.sounds.land      = landSound;
            this.sounds.pickup    = pickupSound;
            this.sounds.gem       = gemSound;
            this.sounds.hurt      = hurtSound;
            this.sounds.shoot     = shootSound;
            this.sounds.enemyDie  = enemyDieSound;
            this.sounds.fall      = fallSound;
            this.sounds.death     = deathSound;
            this.sounds.menuValid = menuValidSound;
            this.sounds.menuBack  = menuBackSound;
            this.music            = musicSound;

            this.sounds.jump.setVolume(0.35);
            this.sounds.jumpHigh.setVolume(0.35);
            this.sounds.land.setVolume(0.3);
            this.sounds.pickup.setVolume(0.4);
            this.sounds.gem.setVolume(0.45);
            this.sounds.hurt.setVolume(0.4);
            this.sounds.shoot.setVolume(0.3);
            this.sounds.enemyDie.setVolume(0.35);
            this.sounds.fall.setVolume(0.4);
            this.sounds.death.setVolume(0.5);
            this.sounds.menuValid.setVolume(0.35);
            this.sounds.menuBack.setVolume(0.35);
            this.music.setVolume(0.2);
            // Note: unlockAudioContext() is called automatically inside SoundManager's
            // constructor via event listeners — no need to call it again here.
            (window as any).gameMusic = this.music;
            this.music.play(true);

            this._tilemapData  = tilemapData;
            this._tilesetImage = tilesetImage;
            this._playerImage  = playerImage;
            this._enemyImage   = enemyImage;
            this.buildLevel(tilemapData, tilesetImage as any, playerImage as any, enemyImage as any);
        } catch (err) {
            console.error('Failed to load resources:', err);
        }
    }

    setupSystems() {
        const particleSystem = new ParticleSystem(this.renderer, this.particleImages);
        this.world.registerSystem(new InputSystem(this.input, this.sounds, particleSystem));
        this.world.registerSystem(new AnimationSystem());
        this.world.registerSystem(new PhysicsSystem());
        this.world.registerSystem(new EnemySystem());
        this.world.registerSystem(new CollisionSystem(this.sounds, (score) => { this.score = score; }, particleSystem));
        this.world.registerSystem(new RespawnSystem());
        this.world.registerSystem(new RenderSystem(this.renderer, this._tilesetImage || undefined));
        this.world.registerSystem(particleSystem);
        (this as any)._particleSystem = particleSystem;

        // Create reusable queries once. The query auto-tracks entities across
        // level rebuilds (resetGame), so it never needs recreating.
        this.collectibleQuery = this.world.createQuery([Collectible]);
    }

    buildLevel(data: any, tilesetImage: HTMLImageElement, playerImage: HTMLImageElement, enemyImage: HTMLImageElement) {
        const TILE_W = 70, TILE_H = 70;

        // Kenney tiles are 64px in a packed atlas; we draw them into the 70px grid.
        // The solid "World" layer is autotiled from the terrain 9-slice (below); the
        // decorative "Background" layer maps each original GID to a Kenney prop.
        const KENNEY_SRC = 64;

        // Original Background-layer GIDs → Kenney decoration tiles (x,y in tiles atlas).
        // The old level used these for fences (ladder rungs), the start/exit signs and
        // grass tufts. Clouds (77/78/91/92/105/106) are dropped — the new parallax sky
        // already provides the atmosphere.
        const BG_TILES: Record<number, { sx: number; sy: number }> = {
            102: { sx: 585, sy: 130 }, // fence      (old ladder/fence rungs)
            139: { sx: 910, sy: 390 }, // sign_exit  (old EXIT sign)
            153: { sx: 845, sy: 390 }, // sign       (old blank sign post / start sign)
            230: { sx: 455, sy: 195 }, // grass      (old grass tufts — NOT flags)
        };

        const level  = data.levels[0];
        const layers = level.layers as Array<{name:string; data:number[][]}>;

        const placeTile = (sx: number, sy: number, ci: number, ri: number) => {
            const e = this.world.createEntity();
            e.addComponent(new Position(ci*TILE_W, ri*TILE_H));
            e.addComponent(new TileRender(sx, sy, tilesetImage, TILE_W, TILE_H, KENNEY_SRC, KENNEY_SRC));
            this.world.updateEntity(e);
        };

        // Renders a layer, mapping each GID to a source tile (or null = skip).
        const renderLayer = (layerName: string, srcFor: (gid: number) => { sx: number; sy: number } | null) => {
            const layer = layers.find(l => l.name === layerName);
            if (!layer) return;
            layer.data.forEach((row, ri) => row.forEach((gid, ci) => {
                if (gid < 0) return;
                const src = srcFor(gid);
                if (!src) return;
                placeTile(src.sx, src.sy, ci, ri);
            }));
        };
        renderLayer('Background', (gid) => BG_TILES[gid] ?? null);

        const worldLayer = layers.find(l => l.name === 'World');
        if (!worldLayer) { console.error("No 'World' layer"); return; }

        // Pass 1 — occupancy grid (used for both autotiling and collision merging).
        const grid: boolean[][] = [];
        let maxCol = 0, maxRow = 0;
        worldLayer.data.forEach((row, ri) => row.forEach((gid, ci) => {
            if (gid < 0) return;
            if (!grid[ri]) grid[ri] = [];
            grid[ri][ci] = true;
            maxCol = Math.max(maxCol, ci);
            maxRow = Math.max(maxRow, ri);
        }));

        // Pass 2 — autotile: pick a 9-slice grass tile per solid cell from its
        // neighbours so platforms get a grass top, dirt sides/corners, and dirt
        // filler in the interior. Kenney's terrain_grass_block_* all share y=585;
        // only the source x changes.
        const solid = (r: number, c: number) => !!(grid[r] && grid[r][c]);
        const GX = {
            full: 260, center: 520,
            top: 715, topLeft: 780, topRight: 845,
            bottom: 325, bottomLeft: 390, bottomRight: 455,
            left: 585, right: 650,
        };
        const TILE_Y = 585;
        const tileX = (r: number, c: number): number => {
            const up = solid(r-1, c), down = solid(r+1, c), left = solid(r, c-1), right = solid(r, c+1);
            if (!up && !down && !left && !right) return GX.full;      // lone block
            if (!up && !left)  return GX.topLeft;
            if (!up && !right) return GX.topRight;
            if (!up)           return GX.top;
            if (!down && !left)  return GX.bottomLeft;
            if (!down && !right) return GX.bottomRight;
            if (!down)         return GX.bottom;
            if (!left)         return GX.left;
            if (!right)        return GX.right;
            return GX.center;
        };
        for (let ri = 0; ri <= maxRow; ri++) {
            if (!grid[ri]) continue;
            for (let ci = 0; ci <= maxCol; ci++) {
                if (!grid[ri][ci]) continue;
                placeTile(tileX(ri, ci), TILE_Y, ci, ri);
            }
        }

        for (let r = 0; r <= maxRow; r++) {
            if (!grid[r]) continue;
            let startC = -1, run = 0;
            for (let c = 0; c <= maxCol+1; c++) {
                if (grid[r]?.[c]) {
                    if (startC === -1) startC = c;
                    run++;
                } else if (startC !== -1) {
                    const col = this.world.createEntity();
                    col.addComponent(new Position(startC*TILE_W, r*TILE_H));
                    col.addComponent(new BoxCollider(run*TILE_W, TILE_H));
                    col.addComponent(new Platform());
                    col.addComponent(new RigidBody(0, 0.5, 0));
                    this.world.updateEntity(col);
                    startC = -1; run = 0;
                }
            }
        }
        renderLayer('Foreground', () => null); // empty in this level

        // ── Player ───────────────────────────────────────────────────────────
        const player = this.world.createEntity();
        player.addComponent(new Position(140, 962));
        player.addComponent(new Velocity(0, 0));
        player.addComponent(new BoxCollider(40, 88));
        player.addComponent(new RigidBody(1, 0));
        player.addComponent(new Player());
        player.addComponent(new SpawnPosition(140, 962));
        // Kenney "character_green" frames (128px). scale 0.75 → ~96px tall to
        // match the 40×88 collider; offsets center the wide frame over it.
        const sprite = new SpriteRender(playerImage, 128, 128, 28, 4, 0.75);
        sprite.atlasFrames = [
            { x:0,   y:258, w:128, h:128 }, // 0 idle
            { x:258, y:258, w:128, h:128 }, // 1 walk_a
            { x:387, y:258, w:128, h:128 }, // 2 walk_b
            { x:129, y:258, w:128, h:128 }, // 3 jump
            { x:774, y:129, w:128, h:128 }, // 4 hit
        ];
        sprite.addAnim('idle', 0.8,  [0]);
        sprite.addAnim('run',  0.12, [1, 2]);
        sprite.addAnim('jump', 1.0,  [3]);
        sprite.addAnim('fall', 0.4,  [3], false);
        sprite.addAnim('pain', 0.3,  [4], false);
        player.addComponent(sprite);
        this.world.updateEntity(player);

        this.cameraX = -140 + 480;
        this.cameraY = -962 + 264;

        // Crates and custom floating platforms removed per request.

        // ── Enemies ──────────────────────────────────────────────────────────
        const spawnSpider = (x: number, y: number, minX: number, maxX: number, spd = 1.2) => {
            const e = this.world.createEntity();
            e.addComponent(new Position(x, y));
            e.addComponent(new BoxCollider(60, 40));
            e.addComponent(new Enemy('spider', minX, maxX, spd));
            // spider → Kenney slime_normal (64px). scale ~0.95 over 60×40 collider.
            const sp = new SpriteRender(enemyImage, 64, 64, 1, 16, 0.95);
            sp.atlasFrames = [
                { x:260, y:325, w:64, h:64 }, // 0 walk_a
                { x:325, y:325, w:64, h:64 }, // 1 walk_b
                { x:195, y:325, w:64, h:64 }, // 2 rest
                { x:130, y:325, w:64, h:64 }, // 3 flat (dead)
            ];
            sp.addAnim('walk', 0.12, [0, 2, 1, 2]);
            sp.addAnim('dead', 0.5,  [3], false);
            e.addComponent(sp);
            this.world.updateEntity(e);
        };
        const spawnBee = (x: number, y: number, minX: number, maxX: number, spd = 2.0) => {
            const e = this.world.createEntity();
            e.addComponent(new Position(x, y));
            e.addComponent(new BoxCollider(50, 40));
            const en = new Enemy('bee', minX, maxX, spd, 25); en.baseY = y;
            e.addComponent(en);
            // bee → Kenney bee (64px). scale ~0.8 over 50×40 collider.
            const sp = new SpriteRender(enemyImage, 64, 64, 0, 6, 0.8);
            sp.atlasFrames = [
                { x:195, y:0, w:64, h:64 }, // 0 bee_a
                { x:260, y:0, w:64, h:64 }, // 1 bee_b
                { x:325, y:0, w:64, h:64 }, // 2 bee_rest (dead)
            ];
            sp.addAnim('fly',    0.15, [0, 1]);
            sp.addAnim('flyAlt', 0.15, [1, 0]);
            sp.addAnim('dead',   0.5,  [2], false);
            e.addComponent(sp);
            this.world.updateEntity(e);
        };
        // Slimes patrol flat ground sections (kept clear of the pits/pipes). y=1010 sits on the ground (top y=1050).
        spawnSpider(1000, 1010,  700, 1350, 1.2);
        spawnSpider(2600, 1010, 2250, 3100, 1.5);
        spawnSpider(4000, 1010, 3600, 4350, 1.5);
        spawnSpider(6100, 1010, 5700, 6600, 1.8);
        spawnSpider(8400, 1010, 8000, 9400, 1.8);
        // Bees float over the gaps — stompable from a ground jump.
        spawnBee(1550, 850, 1350, 1900, 2.0);
        spawnBee(3400, 850, 3150, 3750, 2.2);
        spawnBee(5500, 850, 5250, 5900, 2.0);
        spawnBee(7800, 850, 7600, 8250, 2.2);

        // ── Coin collectibles ─────────────────────────────────────────────────
        const collectibles: Array<{x:number; y:number}> = [
            // coin arcs over the pits
            {x:1480,y:910},{x:1540,y:880},{x:1600,y:910},
            {x:3320,y:900},{x:3400,y:880},{x:3480,y:900},
            {x:5420,y:900},{x:5500,y:880},{x:5580,y:900},
            {x:7680,y:900},{x:7760,y:880},{x:7840,y:900},
            // rows above the floating ?-blocks
            {x:2550,y:850},{x:2620,y:850},{x:2690,y:850},
            {x:4930,y:850},{x:5000,y:850},{x:5070,y:850},
            {x:7030,y:850},{x:7100,y:850},{x:7170,y:850},
            // a trail toward the finish — on the flat run-out PAST the staircase
            // (staircase spans x8960–9380; portal at x10080)
            {x:9520,y:960},{x:9700,y:960},{x:9880,y:960},
        ];
        collectibles.forEach(c => {
            const star = this.world.createEntity();
            star.addComponent(new Position(c.x, c.y));
            star.addComponent(new BoxCollider(20, 20));
            star.addComponent(new Collectible(100, 'coin'));
            // Kenney coin_gold / coin_gold_side from the tiles atlas (64px). scale
            // 0.5 → 32px over the 20×20 collider.
            const sp = new SpriteRender(tilesetImage, 64, 64, 6, 6, 0.5);
            sp.atlasFrames = [
                { x:0,  y:130, w:64, h:64 }, // coin_gold (front)
                { x:65, y:130, w:64, h:64 }, // coin_gold_side (edge)
            ];
            sp.addAnim('spin', 0.14, [0, 1]);
            star.addComponent(sp);
            this.world.updateEntity(star);
        });

        // ── Exit Portal (far end of the level, on the flat past the staircase) ──
        const portal = this.world.createEntity();
        portal.addComponent(new Position(10080, 980));
        portal.addComponent(new BoxCollider(70, 70));
        portal.addComponent(new Portal());
        // TileRender removed to make portal invisible since there is already an exit post tile in the tilemap
        this.world.updateEntity(portal);

        (window as any).gamePlayer       = player;
        (window as any).gameCollectibles = collectibles;
    }

    // ── Canvas drawing helpers ────────────────────────────────────────────────

    /** Draw the Kenney "hills" background tile, scrolled horizontally with parallax. */
    private drawKenneyBg(ctx: CanvasRenderingContext2D, W: number, H: number, camX: number) {
        const img = this._kenneyBackgrounds;
        if (!img) {
            // Fallback: plain gradient sky
            const g = ctx.createLinearGradient(0, 0, 0, H);
            g.addColorStop(0, '#3aa0e8'); g.addColorStop(0.7, '#9fdcff'); g.addColorStop(1, '#dff5ff');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
            return;
        }
        // Kenney "background_color_hills" — a 256×256 tileable scene (sky + hills).
        // Scaled to fill the viewport height and tiled horizontally with parallax.
        const SRC = { x: 514, y: 0, w: 256, h: 256 };
        const scale = H / SRC.h;
        const tileW = SRC.w * scale;
        const parallax = 0.3;
        let x = (-camX * parallax) % tileW;
        if (x > 0) x -= tileW;
        for (; x < W; x += tileW) {
            ctx.drawImage(img, SRC.x, SRC.y, SRC.w, SRC.h,
                Math.round(x), 0, Math.ceil(tileW) + 1, H);
        }
    }

    private drawHUD(ctx: CanvasRenderingContext2D, W: number, player: any) {
        const playerComp = player?.getComponent(Player);
        ctx.textBaseline = 'middle';

        // Draw a panel/box container helper
        const drawHudPanel = (x: number, y: number, w: number, h: number) => {
            // Drop shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(x + 2, y + 3, w, h);
            
            // Base background
            ctx.fillStyle = '#241a3a';
            ctx.fillRect(x, y, w, h);
            
            // Outer thick dark border
            ctx.strokeStyle = '#120e26';
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, w, h);
            
            // Inner purple-light border line
            ctx.strokeStyle = '#4a3a78';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
            
            // Gold corner accent marks or a thin gold border
            ctx.strokeStyle = '#ffd23f';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
        };

        const drawText = (text: string, tx: number, ty: number) => {
            ctx.font = '12px "KenneyFuture", "Press Start 2P", GameFont, monospace';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            ctx.fillText(text, tx + 1.5, ty + 1.5);
            ctx.fillStyle = '#fff4d6';
            ctx.fillText(text, tx, ty);
        };

        const drawTextCenter = (text: string, tx: number, ty: number) => {
            ctx.font = '12px "KenneyFuture", "Press Start 2P", GameFont, monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            ctx.fillText(text, tx + 1.5, ty + 1.5);
            ctx.fillStyle = '#fff4d6';
            ctx.fillText(text, tx, ty);
            ctx.textAlign = 'left';
        };

        // 1. LEFT PANEL: SCORE & COINS
        const panel1X = 14, panel1Y = 10, panel1W = 340, panel1H = 34;
        drawHudPanel(panel1X, panel1Y, panel1W, panel1H);
        
        // Draw Score
        drawText('SCORE ' + String(this.score).padStart(6, '0'), panel1X + 16, panel1Y + panel1H / 2);

        // Draw Coin
        const totalCoins = (window as any).gameCollectibles?.length || 10;
        const coinsRemaining = this.collectibleQuery.entities.size;
        const coinsCollected = totalCoins - coinsRemaining;
        if (this._tilesetImage) {
            // Kenney hud_coin (tiles atlas) — matches the in-game gold coins.
            ctx.drawImage(this._tilesetImage, 455, 260, 64, 64, panel1X + 213, panel1Y + 5, 24, 24);
        }
        drawText('×' + String(coinsCollected).padStart(2, '0'), panel1X + 243, panel1Y + panel1H / 2);

        // 2. CENTER PANEL: TIMER
        const timeLeft = Math.max(0, Math.ceil(this.timer));
        const panel2W = 120, panel2X = (W - panel2W) / 2, panel2Y = 10, panel2H = 34;
        drawHudPanel(panel2X, panel2Y, panel2W, panel2H);
        drawTextCenter('TIME ' + String(timeLeft).padStart(3, '0'), panel2X + panel2W / 2, panel2Y + panel2H / 2);

        // 3. RIGHT PANEL: PLAYER LIVES & HP HEARTS
        if (playerComp) {
            const panel3W = 280, panel3X = W - 14 - panel3W, panel3Y = 10, panel3H = 34;
            drawHudPanel(panel3X, panel3Y, panel3W, panel3H);

            // Draw Player Life Icon — Kenney's purpose-drawn hud_player_helmet_green
            // avatar badge (tiles atlas), matching the helmeted green player.
            if (this._tilesetImage) {
                ctx.drawImage(this._tilesetImage, 0, 325, 64, 64, panel3X + 8, panel3Y + 3, 28, 28);
            }
            // Draw Lives Text
            drawText('×' + playerComp.lives, panel3X + 42, panel3Y + panel3H / 2);

            // Draw HP Hearts using Kenney hud_heart sprites (tiles atlas).
            // hud_heart (520,260) / hud_heart_half (650,260) / hud_heart_empty (585,260).
            const HS = 22, gap = 3;
            const hp    = playerComp.hp    ?? playerComp.lives    ?? 3;
            const maxHp = playerComp.maxHp ?? playerComp.maxLives ?? 3;
            const hx0   = panel3X + 84;
            const hy    = panel3Y + panel3H / 2 - HS / 2;
            for (let i = 0; i < maxHp; i++) {
                // full when hp covers the whole heart, half when it covers half, else empty
                const srcX = (hp - i) >= 1 ? 520 : (hp - i) >= 0.5 ? 650 : 585;
                if (this._tilesetImage) {
                    ctx.drawImage(this._tilesetImage, srcX, 260, 64, 64, hx0 + i * (HS + gap), hy, HS, HS);
                }
            }
        }
        ctx.textBaseline = 'alphabetic';
    }

    private drawFloats(ctx: CanvasRenderingContext2D, camX: number, camY: number) {
        ctx.font = 'bold 14px "KenneyFuture", "Press Start 2P", GameFont, monospace';
        ctx.textAlign = 'center';
        for (const f of this.floats) {
            ctx.globalAlpha = Math.max(0, f.life);
            ctx.fillStyle = 'rgba(0,0,0,.5)';
            ctx.fillText(f.text, f.x + camX + 2, f.y + camY + 2);
            ctx.fillStyle = f.color;
            ctx.fillText(f.text, f.x + camX, f.y + camY);
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
    }

    startGame() {
        const TARGET_FPS = 60;
        const TARGET_FRAME_TIME = 1000 / TARGET_FPS;
        const VIEW_W = 960, VIEW_H = 528;

        this.loop = new RenderLoop((loop: any) => {
            const ctx = this.renderer.context;

            // ── Non-playing states: keep background rendered behind HTML overlays ──
            if (this.gameState !== 'playing') {
                ctx.clearRect(0, 0, VIEW_W, VIEW_H);
                this.drawKenneyBg(ctx, VIEW_W, VIEW_H, this.cameraX);
                // Animate coins and keep particles alive. This branch only runs on
                // menu/paused screens (not hot), so a one-off queryOnce is fine.
                this.world.queryOnce([Collectible]).forEach((e: any) => {
                    const c = e.getComponent(Collectible); c.phase += 0.12;
                });
                return;
            }

            // ── PLAYING ───────────────────────────────────────────────────────────
            (window as any).gameTime = ((window as any).gameTime || 0) + (1 / TARGET_FPS);

            // Timer countdown
            this.timer -= 1 / TARGET_FPS;
            if (this.timer <= 0) { this.timer = 0; this.gameOver(); return; }

            // Advance coin bob phase (hot: every playing frame → cached query)
            this.collectibleQuery.entities.forEach((e: any) => { e.getComponent(Collectible).phase += 0.12; });

            // Advance float texts
            for (const f of this.floats) { f.y -= 1.1; f.life -= 0.022; }
            this.floats = this.floats.filter(f => f.life > 0);

            // ── Background (Kenney parallax layers) ───────────────────────────
            ctx.clearRect(0, 0, VIEW_W, VIEW_H);
            this.drawKenneyBg(ctx, VIEW_W, VIEW_H, this.cameraX);

            // ── Camera follow player ──────────────────────────────────────────
            const player = (window as any).gamePlayer;
            if (player) {
                const playerPos = player.getComponent(Position);
                const playerCol = player.getComponent(BoxCollider);
                if (playerPos && playerCol) {
                    const pcx = playerPos.x + playerCol.width  / 2;
                    const pcy = playerPos.y + playerCol.height / 2;
                    const targetX = VIEW_W / 2 - pcx;
                    const targetY = VIEW_H / 2 - pcy;
                    this.cameraX += (targetX - this.cameraX) * 0.1;
                    this.cameraY += (targetY - this.cameraY) * 0.1;
                    // Clamp
                    this.cameraX = Math.min(0, Math.max(VIEW_W - 10500, this.cameraX));
                    this.cameraY = Math.min(0, Math.max(VIEW_H - 1400, this.cameraY));
                }
            }

            // ── Update RenderSystem camera ────────────────────────────────────
            const renderSystem = this.world.systems.find((s: any) => s instanceof RenderSystem) as RenderSystem;
            if (renderSystem) { renderSystem.cameraX = this.cameraX; renderSystem.cameraY = this.cameraY; }
            const ps = (this as any)._particleSystem as ParticleSystem | undefined;
            if (ps) { ps.cameraX = this.cameraX; ps.cameraY = this.cameraY; }

            // ── Cap delta ────────────────────────────────────────────────────
            const rawDelta = loop.delta / TARGET_FRAME_TIME;
            const delta    = Math.min(rawDelta, 1);

            // ── ECS update ───────────────────────────────────────────────────
            this.world.execute(delta);

            // ── Float texts (world-space, applied after camera) ───────────────
            this.drawFloats(ctx, this.cameraX, this.cameraY);

            // ── HUD ───────────────────────────────────────────────────────────
            this.drawHUD(ctx, VIEW_W, player);

            // Advance input edge state after the ECS (InputSystem) has read it this
            // frame, so "just pressed" (2) collapses to "held" (1) for next frame.
            this.input.update();

        }, TARGET_FPS);

        this.loop.start();
    }
}
