import { Game } from "./Game";

// Collapse logic
const overlay = document.getElementById('ui-overlay');
const collapseBtn = document.getElementById('collapse-overlay');

if (overlay && collapseBtn) {
    collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        overlay.classList.toggle('collapsed');
        collapseBtn.textContent = overlay.classList.contains('collapsed') ? '+' : '_';
    });

    overlay.addEventListener('click', (e) => {
        if (overlay.classList.contains('collapsed')) {
            overlay.classList.remove('collapsed');
            collapseBtn.textContent = '_';
        }
    });
}

const game = new Game();
game.init();
