import { SAT, Canvas2DRenderer, Input, RenderLoop, FontManager, QuadTree as QuadTreeNS } from "craters";

const Vector = SAT.Vector;
const Box = SAT.Box;
const Polygon = SAT.Polygon;
const Circle = SAT.Circle;
const RigidBody = SAT.RigidBody;
const QuadTree = QuadTreeNS.QuadTree;

// Initialize Renderer
const renderer = new Canvas2DRenderer(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.canvasElement);

// Handle resize (debounced — orientationchange fires before dimensions update)
let _rsz: any;
const _onResize = () => {
    clearTimeout(_rsz);
    _rsz = setTimeout(() => {
        renderer.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio);
        resize();
    }, 150);
};
window.addEventListener('resize', _onResize);
window.addEventListener('orientationchange', _onResize);

// Initialize Input
const input = new Input();
input.bind("Mouse0", "SPAWN_BOX");
input.bind("Mouse2", "SPAWN_CIRCLE");
input.bind("Space", "CLEAR");
input.bind("KeyG", "TOGGLE_GRAVITY");

// Initialize FontManager
const fontManager = new FontManager(renderer, "20px Arial", "#ffffff");
const font = fontManager.load("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:! ");

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

// Game State
let width = window.innerWidth;
let height = window.innerHeight;
const bodies: any[] = []; // SAT.RigidBody[]
const shapes: any[] = []; // (SAT.Polygon | SAT.Circle)[]
let gravityEnabled = true;
let quadtree = new QuadTree(new Box(new Vector(0, 0), width, height));

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;

    // Reset floor
    if (bodies.length > 0 && bodies[0].isStatic) {
        bodies[0].position.y = height - 20;
        const floorShape = new Box(new Vector(width / 2, height - 20), width, 40).toPolygon();
        floorShape.setOffset(new Vector(-width / 2, -20));
        shapes[0] = floorShape;
    }
}

function init() {
    // Create floor
    const floor = new RigidBody(new Vector(width / 2, height - 20), 0, 0.5, 0.5);
    const floorShape = new Box(new Vector(width / 2, height - 20), width, 40).toPolygon();
    floorShape.setOffset(new Vector(-width / 2, -20));

    bodies.push(floor);
    shapes.push(floorShape);

    // Create walls
    const leftWall = new RigidBody(new Vector(0, height / 2), 0, 0.5, 0.5);
    const leftWallShape = new Box(new Vector(0, height / 2), 40, height).toPolygon();
    leftWallShape.setOffset(new Vector(-20, -height / 2));
    bodies.push(leftWall);
    shapes.push(leftWallShape);

    const rightWall = new RigidBody(new Vector(width, height / 2), 0, 0.5, 0.5);
    const rightWallShape = new Box(new Vector(width, height / 2), 40, height).toPolygon();
    rightWallShape.setOffset(new Vector(-20, -height / 2));
    bodies.push(rightWall);
    shapes.push(rightWallShape);
}

function spawnBox(x: number, y: number) {
    const w = 30 + Math.random() * 20;
    const h = 30 + Math.random() * 20;
    const body = new RigidBody(new Vector(x, y), 1, 0.3, 0.5);
    const box = new Box(new Vector(x, y), w, h);
    const shape = box.toPolygon();
    shape.setOffset(new Vector(-w / 2, -h / 2));

    body.angle = Math.random() * Math.PI * 2;

    bodies.push(body);
    shapes.push(shape);
}

function spawnCircle(x: number, y: number) {
    const r = 15 + Math.random() * 15;
    const body = new RigidBody(new Vector(x, y), 1, 0.7, 0.3);
    const shape = new Circle(new Vector(x, y), r);

    bodies.push(body);
    shapes.push(shape);
}

function update(dt: number) {
    const subSteps = 4;
    const subDt = dt / subSteps;
    const gravity = new Vector(0, 980); // pixels/s^2

    for (let step = 0; step < subSteps; step++) {
        // Clear and rebuild QuadTree
        // quadtree.clear(); // Recreating it is cleaner if bounds change
        // Update bounds in case of resize
        quadtree = new QuadTree(new Box(new Vector(0, 0), width, height));

        // Apply forces and integrate
        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            if (!body.isStatic && gravityEnabled) {
                body.applyForce(gravity.clone().scale(body.mass));
            }
            body.integrate(subDt);

            // Sync shape
            const shape = shapes[i];
            shape.pos.copy(body.position);
            if (shape instanceof Polygon) {
                shape.setAngle(body.angle);
            }

            // Insert into QuadTree
            // We attach the body index to the shape for easy retrieval
            shape.bodyIndex = i;
            quadtree.insert(shape);
        }

        // Collision detection
        const response = new SAT.Response();
        const returnObjects: any[] = [];

        for (let i = 0; i < bodies.length; i++) {
            const b1 = bodies[i];
            const s1 = shapes[i];

            returnObjects.length = 0;
            quadtree.retrieve(returnObjects, s1);

            for (let k = 0; k < returnObjects.length; k++) {
                const s2 = returnObjects[k];
                const j = s2.bodyIndex;

                // Avoid duplicate checks and self-checks
                if (i >= j) continue;

                const b2 = bodies[j];

                if (b1.isStatic && b2.isStatic) continue;
                if (b1.isSleeping && b2.isSleeping) continue;

                response.clear();
                let collided = false;

                if (s1 instanceof Polygon && s2 instanceof Polygon) {
                    collided = SAT.testPolygonPolygon(s1, s2, response);
                } else if (s1 instanceof Circle && s2 instanceof Circle) {
                    collided = SAT.testCircleCircle(s1, s2, response);
                } else if (s1 instanceof Circle && s2 instanceof Polygon) {
                    collided = SAT.testCirclePolygon(s1, s2, response);
                } else if (s1 instanceof Polygon && s2 instanceof Circle) {
                    collided = SAT.testCirclePolygon(s2, s1, response);
                    if (collided) {
                        // Swap normal/vectors because arguments were swapped
                        response.overlapN.reverse();
                        response.overlapV.reverse();
                        const temp = response.a; response.a = response.b; response.b = temp;
                        const tempIn = response.aInB; response.aInB = response.bInA; response.bInA = tempIn;
                    }
                }

                if (collided) {
                    b1.resolveCollision(b2, response);
                    // Sync shape positions back immediately — without this, any
                    // subsequent pair involving s1 or s2 in this same pass detects
                    // a phantom overlap at the pre-correction position and fires an
                    // extra impulse, compounding energy into a violent explosion.
                    s1.pos.copy(b1.position);
                    s2.pos.copy(b2.position);
                }
            }
        }

        // Escape hatch: despawn any dynamic body that has left the arena.
        // In a single pass so we splice from the end to keep indices valid.
        for (let i = bodies.length - 1; i >= 3; i--) {
            const p = bodies[i].position;
            if (p.x < -200 || p.x > width + 200 || p.y < -500 || p.y > height + 200) {
                bodies.splice(i, 1);
                shapes.splice(i, 1);
            }
        }
    }
}

function draw() {
    renderer.clear();

    for (let i = 0; i < bodies.length; i++) {
        const body = bodies[i];
        const shape = shapes[i];

        let color = '';
        let stroke = '#fff';

        if (body.isSleeping) {
            color = '#4a4a4a';
            stroke = '#666';
        } else if (body.isStatic) {
            color = '#333';
            stroke = '#555';
        } else {
            color = `hsl(${i * 20 % 360}, 70%, 60%)`;
        }

        if (shape instanceof Polygon) {
            const worldPoints = shape.calcPoints.map((p: any) => p.clone().add(shape.pos));
            renderer.drawPolygon(worldPoints, color, false);
            // Draw stroke manually if needed, but renderer.drawPolygon fills. 
            // Canvas2DRenderer might not support stroke easily without modification or another call.
            // For now, fill is good enough.
        } else if (shape instanceof Circle) {
            const pos = shape.pos.clone().add(shape.offset);
            renderer.drawCircle(pos.x, pos.y, shape.r, color, false);

            // Draw rotation line
            const lineEnd = new Vector(
                pos.x + Math.cos(body.angle) * shape.r,
                pos.y + Math.sin(body.angle) * shape.r
            );
            renderer.drawLine(pos.x, pos.y, lineEnd.x, lineEnd.y, stroke, 1);
        }
    }
}

// Input Handling
let lastSpace = 0;
let lastG = 0;
// FPS State
let frames = 0;
let fps = 0;
let lastTime = 0;

const renderLoop = new RenderLoop((loop: any) => {
    const dt = Math.min(loop.delta / 1000, 0.05);

    // Input
    if (input.isPressed("SPAWN_BOX") === 2) {
        const rect = renderer.canvasElement.getBoundingClientRect();
        spawnBox(input.pointerPosition.x - rect.left, input.pointerPosition.y - rect.top);
    }
    if (input.isPressed("SPAWN_CIRCLE") === 2) {
        const rect = renderer.canvasElement.getBoundingClientRect();
        spawnCircle(input.pointerPosition.x - rect.left, input.pointerPosition.y - rect.top);
    }

    if (input.isPressed("CLEAR") && Date.now() - lastSpace > 200) {
        bodies.splice(3);
        shapes.splice(3);
        lastSpace = Date.now();
    }

    if (input.isPressed("TOGGLE_GRAVITY") && Date.now() - lastG > 200) {
        gravityEnabled = !gravityEnabled;
        lastG = Date.now();
    }

    update(dt);
    draw();

    // FPS Counter
    frames++;
    const currentTime = loop.elapsed / 1000;
    if (currentTime - lastTime >= 1) {
        fps = frames;
        frames = 0;
        lastTime = currentTime;
    }

    // Draw UI with FontManager
    font.draw("FPS: " + fps, window.innerWidth - 120, 30);
    font.draw("Bodies: " + bodies.length, window.innerWidth - 120, 60);
});

// Prevent context menu
window.addEventListener('contextmenu', e => e.preventDefault());

init();
renderLoop.start();
