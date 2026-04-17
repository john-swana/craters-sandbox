import { EntityComponentSystem as ECS, Canvas2DRenderer, Input, RenderLoop, FontManager, SoundManager } from "craters";
import { Position } from "./components/Position";
import { Velocity } from "./components/Velocity";
import { BoxCollider } from "./components/BoxCollider";
import { Player } from "./components/Player";
import { Platform } from "./components/Platform";
import { Collectible } from "./components/Collectible";
import { Crate } from "./components/Crate";
import { TileRender } from "./components/TileRender";
import { SpriteRender } from "./components/SpriteRender";
import { InputSystem } from "./systems/InputSystem";
import { AnimationSystem } from "./systems/AnimationSystem";
import { PhysicsSystem } from "./systems/PhysicsSystem";
import { CollisionSystem } from "./systems/CollisionSystem";
import { RenderSystem } from "./systems/RenderSystem";
import { RigidBody } from "./components/RigidBody";
import { SpawnPosition } from "./components/SpawnPosition";
import { RespawnSystem } from "./systems/RespawnSystem";

export class Game {
    renderer: any;
    input: any;
    world: any;
    fontSmall: any;
    fontMedium: any;
    fontLarge: any;
    sounds: any;
    music: any;
    score: number;
    loop: any;
    cameraX: number;
    cameraY: number;

    constructor() {
        this.renderer = new Canvas2DRenderer(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.canvasElement);

        this.input = new Input();
        this.bindInput();

        this.world = new ECS.World();
        this.sounds = {};
        this.score = 0;
        this.cameraX = 0;
        this.cameraY = 0;

        let _rsz: any;
        const _onResize = () => {
            clearTimeout(_rsz);
            _rsz = setTimeout(() => this.renderer.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio), 150);
        };
        window.addEventListener('resize', _onResize);
        window.addEventListener('orientationchange', _onResize);

        // Prevent space from scrolling the page
        window.addEventListener('keydown', (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
            }
        });
    }

    bindInput() {
        this.input.bind("ArrowLeft", "MOVE_LEFT");
        this.input.bind("KeyA", "MOVE_LEFT");
        this.input.bind("ArrowRight", "MOVE_RIGHT");
        this.input.bind("KeyD", "MOVE_RIGHT");
        this.input.bind("Space", "JUMP");
        this.input.bind("ArrowUp", "JUMP");
        this.input.bind("KeyW", "JUMP");
    }

    async init() {
        await this.loadResources();
        this.setupSystems();
        this.startGame();
    }

    async loadResources() {
        try {
            // Load Tilemap JSON
            const response = await fetch('./assets/tilemap.json');
            const tilemapData = await response.json();

            // Load Tileset Image
            const image = new Image();
            image.src = './assets/platformer.png';

            // Load Player Image
            const playerImage = new Image();
            playerImage.src = './assets/player.png';

            // Load Coin Image
            const coinImage = new Image();
            coinImage.src = './assets/coin.png';

            await Promise.all([
                new Promise((resolve, reject) => {
                    image.onload = resolve;
                    image.onerror = reject;
                }),
                new Promise((resolve, reject) => {
                    playerImage.onload = resolve;
                    playerImage.onerror = reject;
                }),
                new Promise((resolve, reject) => {
                    coinImage.onload = resolve;
                    coinImage.onerror = reject;
                }),
                document.fonts.load("16px GameFont")
            ]);

            // Initialize font AFTER the font has loaded
            const fontManagerSmall = new FontManager(this.renderer, "16px GameFont", "#ffffff");
            this.fontSmall = fontManagerSmall.load("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:!., ");

            const fontManagerMedium = new FontManager(this.renderer, "24px GameFont", "#ffffff");
            this.fontMedium = fontManagerMedium.load("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:!., ");

            const fontManagerLarge = new FontManager(this.renderer, "48px GameFont", "#ffffff");
            this.fontLarge = fontManagerLarge.load("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:!., ");

            // Initialize sound manager and load sounds
            const soundManager = new SoundManager();
            const [jumpSound, landSound, pickupSound, hurtSound, musicSound] = await Promise.all([
                soundManager.load('./assets/audio/jump.wav'),
                soundManager.load('./assets/audio/land.wav'),
                soundManager.load('./assets/audio/pickup.wav'),
                soundManager.load('./assets/audio/hurt.wav'),
                soundManager.load('./assets/audio/music.wav'),
            ]);

            this.sounds.jump = jumpSound;
            this.sounds.land = landSound;
            this.sounds.pickup = pickupSound;
            this.sounds.hurt = hurtSound;
            this.music = musicSound;

            // Set sound volumes
            this.sounds.jump.setVolume(0.3);
            this.sounds.land.setVolume(0.2);
            this.sounds.pickup.setVolume(0.4);
            this.sounds.hurt.setVolume(0.3);
            this.music.setVolume(0.2);

            // Unlock audio context (required for autoplay on some browsers)
            await soundManager.unlockAudioContext();

            // Start background music and set up looping
            (window as any).gameMusic = this.music;

            this.music.play(true);

            this.buildLevel(tilemapData, image, playerImage, coinImage);
        } catch (err) {
            console.error("Failed to load resources:", err);
            // alert("Failed to load resources. Check console.");
        }
    }

    setupSystems() {
        this.world.registerSystem(new InputSystem(this.input, this.sounds));
        this.world.registerSystem(new AnimationSystem());
        this.world.registerSystem(new PhysicsSystem());
        this.world.registerSystem(new CollisionSystem(this.sounds, (score) => {
            this.score = score;
        }));
        this.world.registerSystem(new RespawnSystem());
        this.world.registerSystem(new RenderSystem(this.renderer));
    }

    buildLevel(data: any, tilesetImage: HTMLImageElement, playerImage: HTMLImageElement, coinImage: HTMLImageElement) {
        const TILE_WIDTH = 70;
        const TILE_HEIGHT = 70;

        // Find and render background layer
        const backgroundLayer = data.layers.find((l: any) => l.name === "background");
        if (backgroundLayer && backgroundLayer.data) {
            // Background layer uses grid format: array of rows, each containing tile indices
            backgroundLayer.data.forEach((row: number[], rowIndex: number) => {
                row.forEach((tileIndex: number, colIndex: number) => {
                    if (tileIndex === -1) return; // Skip empty tiles

                    // Calculate source position from tile index
                    // Assuming tileset has 14 columns (980 / 70 = 14)
                    const tilesPerRow = 14;
                    const srcX = tileIndex % tilesPerRow;
                    const srcY = Math.floor(tileIndex / tilesPerRow);

                    // Create background tile entity
                    const bgTile = this.world.createEntity();
                    bgTile.addComponent(new Position(colIndex * TILE_WIDTH, rowIndex * TILE_HEIGHT));
                    bgTile.addComponent(new TileRender(srcX * TILE_WIDTH, srcY * TILE_HEIGHT, tilesetImage, TILE_WIDTH, TILE_HEIGHT));
                    this.world.updateEntity(bgTile);
                });
            });
        }

        // Find world layer
        const worldLayer = data.layers.find((l: any) => l.name === "world");
        if (!worldLayer) {
            console.error("No 'world' layer found in tilemap");
            return;
        }

        // Grid to track platform locations for collider aggregation
        const grid: boolean[][] = [];
        let maxX = 0;
        let maxY = 0;

        worldLayer.data.forEach((tileData: any) => {
            const [srcX, srcY, destX, destY] = tileData;

            // Update grid bounds
            maxX = Math.max(maxX, destX);
            maxY = Math.max(maxY, destY);

            // Create Visual-Only Platform Entity
            const platform = this.world.createEntity();
            platform.addComponent(new Position(destX * TILE_WIDTH, destY * TILE_HEIGHT));
            // Removed BoxCollider and Platform components from visual entity

            // Calculate pixel coordinates for source
            const pixelSrcX = srcX * TILE_WIDTH;
            const pixelSrcY = srcY * TILE_HEIGHT;

            platform.addComponent(new TileRender(pixelSrcX, pixelSrcY, tilesetImage, TILE_WIDTH, TILE_HEIGHT));
            this.world.updateEntity(platform);

            // Mark grid position
            if (!grid[destY]) grid[destY] = [];
            grid[destY][destX] = true;
        });

        // Generate Aggregated Colliders
        for (let y = 0; y <= maxY; y++) {
            if (!grid[y]) continue;

            let startX = -1;
            let width = 0;

            for (let x = 0; x <= maxX + 1; x++) {
                if (grid[y][x]) {
                    if (startX === -1) {
                        startX = x;
                    }
                    width++;
                } else {
                    if (startX !== -1) {
                        // End of a run, create collider
                        const collider = this.world.createEntity();
                        collider.addComponent(new Position(startX * TILE_WIDTH, y * TILE_HEIGHT));
                        collider.addComponent(new BoxCollider(width * TILE_WIDTH, TILE_HEIGHT));
                        collider.addComponent(new Platform());
                        collider.addComponent(new RigidBody(0, 0.5, 0)); // Static body, no bounce
                        this.world.updateEntity(collider);

                        startX = -1;
                        width = 0;
                    }
                }
            }
        }

        // Create Player
        const player = this.world.createEntity();
        player.addComponent(new Position(100, 300));
        player.addComponent(new Velocity(0, 0));
        player.addComponent(new BoxCollider(40, 88));
        player.addComponent(new RigidBody(1, 0)); // Dynamic body, no friction (handled manually/input)
        player.addComponent(new Player());
        player.addComponent(new SpawnPosition(100, 300));

        const sprite = new SpriteRender(playerImage, 75, 100, 17, 10);
        sprite.addAnim('idle', 1.0, [15, 15, 15, 15, 15, 14]);
        sprite.addAnim('run', 0.07, [4, 5, 11, 0, 1, 2, 7, 8, 9, 3]);
        sprite.addAnim('jump', 1.0, [13]);
        sprite.addAnim('fall', 0.4, [13, 12], false);
        sprite.addAnim('pain', 0.3, [6], false);

        player.addComponent(sprite);
        this.world.updateEntity(player);

        // Create Collectibles (Stars)
        const collectibles = [
            { x: 260, y: 410 },
            { x: 510, y: 310 },
            { x: 150, y: 210 },
            { x: 650, y: 210 },
            { x: 390, y: 110 },
        ];

        collectibles.forEach(c => {
            const star = this.world.createEntity();
            star.addComponent(new Position(c.x, c.y));
            star.addComponent(new BoxCollider(20, 20));
            star.addComponent(new Collectible(10));

            const sprite = new SpriteRender(coinImage, 36, 36, 8, 8);
            sprite.addAnim('spin', 0.1, [0, 1, 2]);

            star.addComponent(sprite);
            this.world.updateEntity(star);
        });

        // Create Crates (using tile sprites from the tileset)
        const crateData = [
            { x: 200, y: 200, tileX: 0, tileY: 12 },  // Crate 3 - Above platform
            { x: 350, y: 100, tileX: 1, tileY: 9 },  // Crate 1 - On floor
            { x: 150, y: 300, tileX: 1, tileY: 9 },  // Crate 2 - On floor
        ];

        crateData.forEach(data => {
            const crate = this.world.createEntity();
            crate.addComponent(new Position(data.x, data.y));
            crate.addComponent(new Velocity(0, 0));
            crate.addComponent(new BoxCollider(70, 70));
            crate.addComponent(new Crate(1));
            crate.addComponent(new RigidBody(1, 0.3, 0)); // Mass 1, Friction 0.3, Restitution 0 (no bounce)
            crate.addComponent(new SpawnPosition(data.x, data.y));
            crate.addComponent(new TileRender(data.tileX * 70, data.tileY * 70, tilesetImage, 70, 70));
            this.world.updateEntity(crate);
        });

        // Expose player and collectibles for UI
        (window as any).gamePlayer = player;
        (window as any).gameCollectibles = collectibles;
    }

    startGame() {
        const TARGET_FPS = 40;
        const TARGET_FRAME_TIME = 1000 / TARGET_FPS;

        this.loop = new RenderLoop((loop: any) => {
            // Cap delta time to prevent physics issues when tab is inactive
            const rawDelta = loop.delta / TARGET_FRAME_TIME;
            const delta = Math.min(rawDelta, 1);

            const w = this.renderer.width;
            const h = this.renderer.height;

            // Clear and fill canvas background to prevent motion blur
            const ctx = this.renderer.context;
            ctx.clearRect(0, 0, w, h);
            ctx.fillStyle = '#87CEEB'; // Sky blue
            ctx.fillRect(0, 0, w, h);

            // Camera follows player with deadzone
            const player = (window as any).gamePlayer;

            if (player) {
                const playerPos = player.getComponent(Position);
                const playerCol = player.getComponent(BoxCollider);

                if (playerPos && playerCol) {

                    // Calculate player center in world coordinates
                    const playerCenterX = playerPos.x + (playerCol.width / 2);
                    const playerCenterY = playerPos.y + (playerCol.height / 2);

                    // Calculate player position in screen space
                    const playerScreenX = playerCenterX + this.cameraX;
                    const playerScreenY = playerCenterY + this.cameraY;

                    const screenCenterX = w / 2;
                    const screenCenterY = h / 2;

                    // Deadzone proportional to screen size — feels consistent on all devices
                    const DEADZONE_WIDTH = w * 0.30;
                    const DEADZONE_HEIGHT = h * 0.25;

                    // Calculate deadzone bounds
                    const deadzoneLeft = screenCenterX - DEADZONE_WIDTH / 2;
                    const deadzoneRight = screenCenterX + DEADZONE_WIDTH / 2;
                    const deadzoneTop = screenCenterY - DEADZONE_HEIGHT / 2;
                    const deadzoneBottom = screenCenterY + DEADZONE_HEIGHT / 2;

                    // Adjust camera if player is outside deadzone
                    if (playerScreenX < deadzoneLeft) {
                        this.cameraX += deadzoneLeft - playerScreenX;
                    } else if (playerScreenX > deadzoneRight) {
                        this.cameraX += deadzoneRight - playerScreenX;
                    }

                    if (playerScreenY < deadzoneTop) {
                        this.cameraY += deadzoneTop - playerScreenY;
                    } else if (playerScreenY > deadzoneBottom) {
                        this.cameraY += deadzoneBottom - playerScreenY;
                    }
                }
            }

            // Update RenderSystem camera
            const renderSystem = this.world.systems.find((s: any) => s instanceof RenderSystem) as RenderSystem;
            if (renderSystem) {
                renderSystem.cameraX = this.cameraX;
                renderSystem.cameraY = this.cameraY;
            }

            // Update ECS
            this.world.execute(delta);

            // Draw HUD at fixed screen-space positions (never camera-relative)
            const margin = 20;
            this.fontMedium.draw("Score: " + this.score, margin, margin);

            const collectibles = (window as any).gameCollectibles;

            if (player && collectibles) {
                this.fontMedium.draw("Coins: " + (collectibles.length - this.world.createQuery([Collectible]).entities.size), margin, margin + 28);
                const playerComp = player.getComponent(Player);
                this.fontSmall.draw("Grounded: " + (playerComp.grounded ? "Yes" : "No"), margin, margin + 56);

                // Win condition - centred on the screen
                if (this.world.createQuery([Collectible]).entities.size === 0) {
                    this.fontLarge.draw("YOU WIN!", w / 2 - 80, h / 2 - 24);
                }
            }
        }, TARGET_FPS);

        this.loop.start();
    }
}
