/**
 * NEON BLADE: SLICE ARENA
 * Core Engine
 */

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const flash = document.getElementById('screen-flash');

const COLORS = {
    cyan: '#00f3ff',
    pink: '#ff0055',
    purple: '#bc13fe',
    yellow: '#fff200',
    bomb: '#333'
};

// --- UTILS ---
const rand = (min, max) => Math.random() * (max - min) + min;

// --- BLADE TRAIL SYSTEM ---
class Blade {
    constructor() {
        this.path = [];
        this.isSlicing = false;
    }

    update(x, y, isDown) {
        this.isSlicing = isDown;
        if (this.isSlicing) {
            this.path.push({ x, y, age: 0 });
        }
        
        this.path.forEach(p => p.age++);
        this.path = this.path.filter(p => p.age < 12);
    }

    draw() {
        if (this.path.length < 2) return;
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = COLORS.cyan;
        ctx.strokeStyle = COLORS.cyan;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        ctx.beginPath();
        ctx.moveTo(this.path[0].x, this.path[0].y);
        
        for (let i = 1; i < this.path.length; i++) {
            ctx.lineWidth = 5 * (1 - i / this.path.length);
            ctx.lineTo(this.path[i].x, this.path[i].y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
}

// --- GAME OBJECTS ---
class Sliceable {
    constructor(w, h) {
        this.reset(w, h);
    }

    reset(w, h) {
        this.x = rand(w * 0.2, w * 0.8);
        this.y = h + 50;
        this.vx = rand(-4, 4);
        this.vy = rand(-16, -22);
        this.radius = 25;
        this.sliced = false;
        this.angle = 0;
        this.rotSpeed = rand(-0.1, 0.1);
        
        const roll = Math.random();
        if (roll < 0.15) this.type = 'BOMB';
        else if (roll < 0.25) this.type = 'GOLD';
        else this.type = 'NORMAL';

        this.color = this.type === 'BOMB' ? COLORS.bomb : 
                     this.type === 'GOLD' ? COLORS.yellow : COLORS.purple;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.25; // Gravity
        this.angle += this.rotSpeed;
    }

    draw() {
        if (this.sliced) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        ctx.shadowBlur = 15;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        
        if (this.type === 'BOMB') {
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
            // Bomb detail
            ctx.fillStyle = COLORS.pink;
            ctx.fillRect(-5, -5, 10, 10);
        } else {
            ctx.beginPath();
            ctx.rect(-this.radius, -this.radius, this.radius*2, this.radius*2);
            ctx.fill();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x; this.y = y;
        this.color = color;
        this.vx = rand(-5, 5);
        this.vy = rand(-5, 5);
        this.life = 1.0;
    }
    update() {
        this.x += this.vx; this.y += this.vy;
        this.life -= 0.03;
    }
    draw() {
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 4, 4);
        ctx.globalAlpha = 1;
    }
}

// --- GAME MANAGER ---
class Game {
    constructor() {
        this.canvas = canvas;
        this.init();
        this.blade = new Blade();
        this.objects = [];
        this.particles = [];
        this.score = 0;
        this.lives = 3;
        this.active = false;
        this.mouse = { x: 0, y: 0, down: false };
        this.lastSpawn = 0;
        
        this.bindEvents();
        this.loop();
    }

    init() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    bindEvents() {
        const move = (e) => {
            const pos = e.touches ? e.touches[0] : e;
            this.mouse.x = pos.clientX;
            this.mouse.y = pos.clientY;
        };
        window.addEventListener('mousemove', move);
        window.addEventListener('touchmove', move);
        window.addEventListener('mousedown', () => this.mouse.down = true);
        window.addEventListener('touchstart', () => this.mouse.down = true);
        window.addEventListener('mouseup', () => this.mouse.down = false);
        window.addEventListener('touchend', () => this.mouse.down = false);

        document.getElementById('start-btn').onclick = () => this.start();
        document.getElementById('restart-btn').onclick = () => this.start();
    }

    start() {
        this.score = 0;
        this.lives = 3;
        this.objects = [];
        this.active = true;
        document.querySelectorAll('.overlay').forEach(el => el.classList.remove('active'));
        this.updateHUD();
    }

    updateHUD() {
        document.getElementById('score-val').innerText = this.score.toString().padStart(4, '0');
        const heartStr = '❤️'.repeat(this.lives);
        document.getElementById('lives-container').innerText = heartStr;
    }

    triggerFlash() {
        flash.style.opacity = '0.5';
        setTimeout(() => flash.style.opacity = '0', 100);
    }

    checkSlices() {
        if (!this.mouse.down || this.blade.path.length < 2) return;

        this.objects.forEach(obj => {
            if (obj.sliced) return;
            
            // Check collision with the last segment of the blade
            const p1 = this.blade.path[this.blade.path.length - 1];
            const dist = Math.hypot(obj.x - p1.x, obj.y - p1.y);
            
            if (dist < obj.radius + 10) {
                this.sliceObject(obj);
            }
        });
    }

    sliceObject(obj) {
        obj.sliced = true;
        for(let i=0; i<12; i++) this.particles.push(new Particle(obj.x, obj.y, obj.color));

        if (obj.type === 'BOMB') {
            this.lives--;
            this.triggerFlash();
            // Screen Shake would go here
        } else {
            this.score += obj.type === 'GOLD' ? 50 : 10;
        }

        this.updateHUD();
        if (this.lives <= 0) this.gameOver();
    }

    gameOver() {
        this.active = false;
        document.getElementById('game-over').classList.add('active');
        document.getElementById('final-val').innerText = this.score;
        
        const best = localStorage.getItem('neon_best') || 0;
        if (this.score > best) localStorage.setItem('neon_best', this.score);
        document.getElementById('best-val').innerText = localStorage.getItem('neon_best');
    }

    loop(now) {
        ctx.fillStyle = 'rgba(5, 5, 10, 0.3)'; // Motion Blur Trail
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.active) {
            // Spawning
            if (now - this.lastSpawn > 1000) {
                this.objects.push(new Sliceable(this.canvas.width, this.canvas.height));
                this.lastSpawn = now;
            }

            this.checkSlices();

            this.objects.forEach((obj, i) => {
                obj.update();
                obj.draw();
                if (obj.y > this.canvas.height + 100) {
                    if (!obj.sliced && obj.type !== 'BOMB') {
                        this.lives--;
                        this.updateHUD();
                        if (this.lives <= 0) this.gameOver();
                    }
                    this.objects.splice(i, 1);
                }
            });
        }

        this.particles.forEach((p, i) => {
            p.update();
            p.draw();
            if (p.life <= 0) this.particles.splice(i, 1);
        });

        this.blade.update(this.mouse.x, this.mouse.y, this.mouse.down);
        this.blade.draw();

        requestAnimationFrame((t) => this.loop(t));
    }
}

// Start Engine
new Game();