import { SAT, Canvas2DRenderer, Input, RenderLoop, FontManager, QuadTree as QuadTreeNS } from "craters";

const Vector = SAT.Vector;
const Box = SAT.Box;
const Polygon = SAT.Polygon;
const Circle = SAT.Circle;

// Interfaces
interface Body {
    id: number;
    shape: any; // SAT.Circle | SAT.Polygon
    vel: any; // SAT.Vector
    color: string;
    getAABBAsBox: () => any;
}

// Initialize Renderer
const renderer = new Canvas2DRenderer(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.canvasElement);

// Handle resize (debounced — orientationchange fires before dimensions update)
// visualViewport covers iOS address-bar show/hide which doesn't fire 'resize'
let _rsz: any;
const _onResize = () => { clearTimeout(_rsz); _rsz = setTimeout(() => renderer.resize(window.innerWidth, window.innerHeight), 150); };
window.addEventListener('resize', _onResize);
window.addEventListener('orientationchange', _onResize);
if (window.visualViewport) window.visualViewport.addEventListener('resize', _onResize);

// Initialize Input
const input = new Input();
input.bind("Mouse0", "TOGGLE_MODE");
input.bind("Touch0", "TOGGLE_MODE");

// Initialize FontManager
const fontManager = new FontManager(renderer, "20px Arial", "#ffffff");
const font = fontManager.load("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:! ");



// --- Interactive Mode State ---
const staticBox = new Box(new Vector(window.innerWidth / 2 - 100, window.innerHeight / 2 - 75), 200, 150).toPolygon();
const staticPoly = new Polygon(new Vector(window.innerWidth / 2 + 200, window.innerHeight / 2), [
    new Vector(0, 0), new Vector(50, 50), new Vector(0, 100), new Vector(-50, 50)
]);

const mouseCircle = new Circle(new Vector(100, 100), 40);
const mousePoly = new Box(new Vector(0, 0), 60, 60).toPolygon();
mousePoly.setOffset(new Vector(-30, -30)); // Center it

let controlMode = 'circle'; // 'circle' or 'polygon'
let mousePos = new Vector(0, 0);
let wasColliding = false;

// --- Benchmark Mode State ---
let isBenchmark = false;
const bodies: Body[] = [];
let numBodies = 100;
let showDebug = true;
let fps = 0;
let frames = 0;
let lastTime = 0;

function initBenchmark() {
    bodies.length = 0;
    function createRegularPolygon(x: number, y: number, radius: number, sides: number) {
        const points = [];
        const angleStep = (Math.PI * 2) / sides;
        for (let i = 0; i < sides; i++) {
            points.push(new Vector(
                Math.cos(i * angleStep) * radius,
                Math.sin(i * angleStep) * radius
            ));
        }
        return new Polygon(new Vector(x, y), points);
    }

    for (let i = 0; i < numBodies; i++) {
        const isCircle = Math.random() > 0.5;
        const x = Math.random() * (window.innerWidth - 100) + 50;
        const y = Math.random() * (window.innerHeight - 100) + 50;
        let shape;
        if (isCircle) {
            shape = new Circle(new Vector(x, y), 10 + Math.random() * 20);
        } else {
            // Random polygon with 3 to 6 sides
            const sides = Math.floor(Math.random() * 4) + 3;
            shape = createRegularPolygon(x, y, 20 + Math.random() * 20, sides);
        }
        bodies.push({
            id: i,
            shape: shape,
            vel: new Vector((Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4),
            color: '#' + Math.floor(Math.random() * 16777215).toString(16),
            getAABBAsBox: function () {
                return this.shape.getAABBAsBox();
            }
        });
    }
}

// UI Controls
const toggleBtn = document.getElementById('toggle-mode-btn') as HTMLButtonElement;
const instructions = document.getElementById('instructions') as HTMLParagraphElement;
const benchmarkControls = document.getElementById('benchmark-controls') as HTMLDivElement;
const debugToggle = document.getElementById('debug-toggle') as HTMLInputElement;
const bodyCountSlider = document.getElementById('body-count') as HTMLInputElement;
const bodyCountValue = document.getElementById('body-count-value') as HTMLSpanElement;
const collapseBtn = document.getElementById('collapse-overlay') as HTMLButtonElement;
const uiOverlay = document.getElementById('ui-overlay') as HTMLDivElement;

// Collapse button logic
if (collapseBtn && uiOverlay) {
    collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering other clicks
        uiOverlay.classList.toggle('collapsed');
        if (uiOverlay.classList.contains('collapsed')) {
            collapseBtn.textContent = '+';
            collapseBtn.title = "Expand Panel";
        } else {
            collapseBtn.textContent = '_';
            collapseBtn.title = "Collapse Panel";
        }
    });

    // Also allow clicking the collapsed overlay to expand it
    uiOverlay.addEventListener('click', (e) => {
        if (uiOverlay.classList.contains('collapsed') && e.target !== collapseBtn) {
            uiOverlay.classList.remove('collapsed');
            collapseBtn.textContent = '_';
            collapseBtn.title = "Collapse Panel";
        }
    });
}

// Debug toggle - handle both change and touch
debugToggle.addEventListener('change', (e: any) => {
    showDebug = e.target.checked;
});
debugToggle.addEventListener('touchend', (e: any) => {
    e.preventDefault();
    debugToggle.checked = !debugToggle.checked;
    showDebug = debugToggle.checked;
});


// Body count slider
bodyCountSlider.addEventListener('input', (e: any) => {
    numBodies = parseInt(e.target.value);
    bodyCountValue.textContent = numBodies.toString();
    if (isBenchmark) {
        initBenchmark();
    }
});

// Toggle Button - handle both click and touch
const handleToggle = () => {
    isBenchmark = !isBenchmark;
    if (isBenchmark) {
        initBenchmark();
        fps = 0;
        frames = 0;
        lastTime = 0; // Will be set on first frame
        toggleBtn.textContent = "Switch to Interactive";
        instructions.textContent = "Benchmark Mode: " + numBodies + " objects. Watch the FPS!";
        benchmarkControls.style.display = 'block';

    } else {
        toggleBtn.textContent = "Switch to Benchmark";
        instructions.textContent = "Move mouse to control the Circle. Click to toggle between Circle and Polygon control.";
        benchmarkControls.style.display = 'none';
    }
};

toggleBtn.addEventListener('click', handleToggle);
toggleBtn.addEventListener('touchend', (e) => {
    e.preventDefault(); // Prevent mouse events from firing
    handleToggle();
});


function drawPolygon(poly: any, color: string, overlapV?: any) {
    // Calculate world points for rendering
    const worldPoints = poly.calcPoints.map((p: any) => p.clone().add(poly.pos));
    renderer.drawPolygon(worldPoints, color, false);

    // Draw center
    renderer.drawCircle(poly.pos.x, poly.pos.y, 2, color, true);

    if (overlapV) {
        renderer.drawLine(poly.pos.x, poly.pos.y, poly.pos.x - overlapV.x, poly.pos.y - overlapV.y, 'red', 3);
    }
}

function drawCircle(circle: any, color: string, overlapV?: any) {
    const pos = circle.pos.clone().add(circle.offset);
    renderer.drawCircle(pos.x, pos.y, circle.r, color, false);

    // Draw center
    renderer.drawCircle(pos.x, pos.y, 2, color, true);

    if (overlapV) {
        renderer.drawLine(pos.x, pos.y, pos.x - overlapV.x, pos.y - overlapV.y, 'red', 3);
    }
}

const renderLoop = new RenderLoop((loop: any) => {
    let time = loop.elapsed / 1000;
    renderer.clear();

    if (isBenchmark) {
        // Benchmark Logic
        const response = new SAT.Response();

        // Update and Bounce
        for (let i = 0; i < bodies.length; i++) {
            const b = bodies[i];
            b.shape.pos.add(b.vel);


            // Screen bounds - account for shape size
            if (b.shape instanceof Circle) {
                const r = b.shape.r;
                if (b.shape.pos.x - r < 0) {
                    b.shape.pos.x = r;
                    b.vel.x *= -1;
                } else if (b.shape.pos.x + r > window.innerWidth) {
                    b.shape.pos.x = window.innerWidth - r;
                    b.vel.x *= -1;
                }
                if (b.shape.pos.y - r < 0) {
                    b.shape.pos.y = r;
                    b.vel.y *= -1;
                } else if (b.shape.pos.y + r > window.innerHeight) {
                    b.shape.pos.y = window.innerHeight - r;
                    b.vel.y *= -1;
                }
            } else if (b.shape instanceof Polygon) {
                const aabb = b.shape.getAABBAsBox();
                if (aabb.pos.x < 0) {
                    b.shape.pos.x -= aabb.pos.x;
                    b.vel.x *= -1;
                } else if (aabb.pos.x + aabb.w > window.innerWidth) {
                    b.shape.pos.x -= (aabb.pos.x + aabb.w - window.innerWidth);
                    b.vel.x *= -1;
                }
                if (aabb.pos.y < 0) {
                    b.shape.pos.y -= aabb.pos.y;
                    b.vel.y *= -1;
                } else if (aabb.pos.y + aabb.h > window.innerHeight) {
                    b.shape.pos.y -= (aabb.pos.y + aabb.h - window.innerHeight);
                    b.vel.y *= -1;
                }
            }

            // Rotate polys
            if (b.shape instanceof Polygon) {
                b.shape.setAngle(b.shape.angle + 0.02);
            }
        }


        // Collisions (QuadTree)
        const bounds = new Box(new Vector(0, 0), window.innerWidth, window.innerHeight);
        const qt = new QuadTreeNS.QuadTree(bounds);

        // Insert all bodies into QuadTree
        for (let i = 0; i < bodies.length; i++) {
            qt.insert(bodies[i]);
        }

        const returnObjects: Body[] = [];
        for (let i = 0; i < bodies.length; i++) {
            const b1 = bodies[i];
            returnObjects.length = 0;
            qt.retrieve(returnObjects, b1);

            for (let k = 0; k < returnObjects.length; k++) {
                const b2 = returnObjects[k];

                // Avoid self-collision and duplicate checks
                if (b1 === b2 || b1.id > b2.id) continue;

                response.clear();
                let collided = false;
                let bodyA = b1;
                let bodyB = b2;

                if (b1.shape instanceof Circle && b2.shape instanceof Circle) {
                    collided = SAT.testCircleCircle(b1.shape, b2.shape, response);
                } else if (b1.shape instanceof Circle && b2.shape instanceof Polygon) {
                    collided = SAT.testCirclePolygon(b1.shape, b2.shape, response);
                } else if (b1.shape instanceof Polygon && b2.shape instanceof Circle) {
                    collided = SAT.testCirclePolygon(b2.shape, b1.shape, response);
                    bodyA = b2;
                    bodyB = b1;
                } else if (b1.shape instanceof Polygon && b2.shape instanceof Polygon) {
                    collided = SAT.testPolygonPolygon(b1.shape, b2.shape, response);
                }

                if (collided) {
                    // Separate to avoid sinking
                    const m1 = 1;
                    const m2 = 1;
                    const separation = response.overlapV.clone().scale(0.55);
                    bodyA.shape.pos.sub(separation);
                    bodyB.shape.pos.add(separation);

                    // Impulse-based resolution
                    const relVel = bodyA.vel.clone().sub(bodyB.vel);
                    const velAlongNormal = relVel.dot(response.overlapN);

                    if (velAlongNormal > 0) continue;

                    const e = 0.8;
                    let j = -(1 + e) * velAlongNormal;
                    j /= (1 / m1 + 1 / m2);

                    const impulse = response.overlapN.clone().scale(j);
                    bodyA.vel.add(impulse.clone().scale(1 / m1));
                    bodyB.vel.sub(impulse.clone().scale(1 / m2));
                }
            }
        }
        // Draw
        for (let i = 0; i < bodies.length; i++) {
            const b = bodies[i];
            if (b.shape instanceof Circle) {
                drawCircle(b.shape, b.color, null);
            } else {
                drawPolygon(b.shape, b.color, null);
            }
        }

        // Draw QuadTree debug cells (if enabled)
        if (showDebug) {
            const qtBounds = qt.getAllBounds();
            for (let i = 0; i < qtBounds.length; i++) {
                const box = qtBounds[i];
                renderer.drawRect(box.pos.x, box.pos.y, box.w, box.h, 'rgba(255, 0, 0, 0.2)', false);
            }
        }


        // FPS Counter
        frames++;
        const currentTime = loop.elapsed / 1001; // Current elapsed time in seconds
        if (currentTime - lastTime >= 1) {
            fps = frames;
            frames = 0;
            lastTime = currentTime;
        }
        font.draw("FPS: " + fps, window.innerWidth - 120, 30);
        font.draw("Bodies: " + numBodies, window.innerWidth - 120, 60);

    } else {
        // Interactive Logic
        // Handle Input
        if (input.isPressed("TOGGLE_MODE") === 2) { // 2 means just pressed
            controlMode = controlMode === 'circle' ? 'polygon' : 'circle';
        }

        const rect = renderer.canvasElement.getBoundingClientRect();
        mousePos.x = input.pointerPosition.x - rect.left;
        mousePos.y = input.pointerPosition.y - rect.top;

        // Update controlled shape
        if (controlMode === 'circle') {
            mouseCircle.pos.copy(mousePos);
        } else {
            mousePoly.pos.copy(mousePos);
            mousePoly.setAngle(time);
        }

        // Rotate static poly
        staticPoly.setAngle(time * 0.5);

        // Check collisions
        const response = new SAT.Response();

        let collided = false;
        let overlapV = null;

        // Draw Static Box
        let boxColor = '#00ff00';
        if (controlMode === 'circle') {
            response.clear();
            if (SAT.testCirclePolygon(mouseCircle, staticBox, response)) {
                boxColor = '#ff0000';
                collided = true;
                overlapV = response.overlapV.clone();
            }
        } else {
            response.clear();
            if (SAT.testPolygonPolygon(mousePoly, staticBox, response)) {
                boxColor = '#ff0000';
                collided = true;
                overlapV = response.overlapV.clone();
            }
        }
        drawPolygon(staticBox, boxColor);

        // Draw Static Poly
        let polyColor = '#00ffff';
        // Reset response
        response.clear();

        let collided2 = false;
        let overlapV2 = null;

        if (controlMode === 'circle') {
            response.clear();
            if (SAT.testCirclePolygon(mouseCircle, staticPoly, response)) {
                polyColor = '#ff0000';
                collided2 = true;
                overlapV2 = response.overlapV.clone();
            }
        } else {
            response.clear();
            if (SAT.testPolygonPolygon(mousePoly, staticPoly, response)) {
                polyColor = '#ff0000';
                collided2 = true;
                overlapV2 = response.overlapV.clone();
            }
        }
        drawPolygon(staticPoly, polyColor);

        // Draw Controlled Shape
        if (controlMode === 'circle') {
            drawCircle(mouseCircle, (collided || collided2) ? '#ffaa00' : '#ffffff', (collided ? overlapV : (collided2 ? overlapV2 : null)));
        } else {
            drawPolygon(mousePoly, (collided || collided2) ? '#ffaa00' : '#ffffff', (collided ? overlapV : (collided2 ? overlapV2 : null)));
        }

        // Play sound on collision start
        const isColliding = collided || collided2;
        if (isColliding && !wasColliding) {

        }
        wasColliding = isColliding;

        // Draw UI
        font.draw("Mode: " + controlMode, window.innerWidth - 150, 30);
        if (isColliding) {
            font.draw("COLLISION!", window.innerWidth - 150, 60);
        }
    }
});

// Prevent long-press context menu on mobile
window.addEventListener('contextmenu', e => e.preventDefault());

renderLoop.start();
