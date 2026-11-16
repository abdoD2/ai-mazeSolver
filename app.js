/* The Maze Solver - BFS, DFS, Greedy Best-First, A* and Ant Colony Optimization */
const FREE = 0, WALL = 1, GRASS = 2, MUD = 3;
const COSTS = { 0: 1, 2: 2, 3: 5 };
const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const MAZE_MODES = ["Backtracker", "Prim", "Random walls"];
const ALGO_ORDER = ["BFS", "DFS", "Greedy", "A*"];
const SIZES = [[15, 15], [21, 33], [31, 31], [41, 41], [51, 51]];
const BRUSHES = [{ name: "Wall", val: WALL }, { name: "Grass", val: GRASS }, { name: "Mud", val: MUD }];
const COLORS = {
    bg: "#181a22", panelBg: "#1e212b", gridLine: "#2c2f3a", wall: "#464c5f", free: "#eceff4",
    grass: "#b0d678", mud: "#946846", start: "#2ea05a", goal: "#dc4646", obstacle: "#e11d48", gold: "#ffd700",
    visited: "rgba(70,130,230,0.45)", frontier: "rgba(170,120,235,0.78)", path: "rgba(255,200,40,0.92)",
    pathAhead: "rgba(255,200,40,0.38)",
    confetti: ["#ffd700", "#ff6384", "#36a2eb", "#4bc078", "#c878ff"],
    ranks: { 1: "#ffd700", 2: "#c8cdd7", 3: "#cd7f32", 4: "#787d8c" }
};
const $ = (id) => document.getElementById(id);
const rnd = (n) => Math.floor(Math.random() * n);

/* ---------- Min-heap (Greedy and A*) ---------- */
class MinHeap {
    constructor() { this.d = []; }
    get size() { return this.d.length; }
    push(x) {
        const d = this.d; d.push(x);
        let i = d.length - 1;
        while (i > 0) { const p = (i - 1) >> 1; if (d[i][0] >= d[p][0]) break; [d[i], d[p]] = [d[p], d[i]]; i = p; }
    }
    pop() {
        const d = this.d, top = d[0], last = d.pop();
        if (d.length) {
            d[0] = last; let i = 0;
            for (;;) {
                let m = i; const l = 2 * i + 1, r = l + 1;
                if (l < d.length && d[l][0] < d[m][0]) m = l;
                if (r < d.length && d[r][0] < d[m][0]) m = r;
                if (m === i) break;
                [d[i], d[m]] = [d[m], d[i]]; i = m;
            }
        }
        return top;
    }
}

/* ---------- Sound: Web Audio with compressor + reverb, pentatonic notes ---------- */
class SoundEngine {
    constructor() { this.enabled = true; this.x = null; this.last = {}; this.sk = 0; }
    init() {
        if (this.x) return true;
        try {
            const x = this.x = new (window.AudioContext || window.webkitAudioContext)();
            const comp = x.createDynamicsCompressor(), master = x.createGain();
            master.gain.value = 0.9; this.bus = x.createGain();
            this.bus.connect(comp); comp.connect(master); master.connect(x.destination);
            const n = Math.floor(x.sampleRate * 1.6), buf = x.createBuffer(2, n, x.sampleRate);
            for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3); }
            this.rev = x.createConvolver(); this.rev.buffer = buf;
            const wet = x.createGain(); wet.gain.value = 0.3; this.rev.connect(wet); wet.connect(comp);
            return true;
        } catch (e) { return false; }
    }
    note(f, t = 0, d = 0.3, v = 0.1, type = "triangle", glide = 0) {
        if (!this.enabled || !this.init()) return;
        const x = this.x; if (x.state === "suspended") x.resume();
        const o = x.createOscillator(), g = x.createGain(), n = x.currentTime + t;
        o.type = type; o.frequency.setValueAtTime(f, n);
        if (glide) o.frequency.exponentialRampToValueAtTime(glide, n + d);
        g.gain.setValueAtTime(0.0001, n);
        g.gain.exponentialRampToValueAtTime(v, n + 0.006);
        g.gain.exponentialRampToValueAtTime(0.0001, n + d);
        o.connect(g); g.connect(this.bus); g.connect(this.rev);
        o.start(n); o.stop(n + d + 0.05);
    }
    hz(s) { return 261.63 * Math.pow(2, s / 12); }
    scale(p) { const k = Math.max(0, Math.min(14, Math.floor(p * 14))); return this.hz([0, 2, 4, 7, 9][k % 5] + 12 * Math.floor(k / 5) + 12); }
    play(name, gap = 0) {
        if (!this.enabled) return;
        const now = performance.now() / 1000;
        if (now - (this.last[name] || 0) < gap) return;
        this.last[name] = now;
        const m = {
            click: () => this.note(900, 0, 0.05, 0.05, "sine"),
            tick: () => this.note(1300, 0, 0.05, 0.05, "sine"),
            bump: () => this.note(120, 0, 0.2, 0.16, "sine", 55),
            death: () => {
                this.note(220, 0, 0.28, 0.22, "sawtooth", 55);
                this.note(145, 0.08, 0.45, 0.20, "sawtooth", 38);
            },
            ping: () => { this.note(880, 0, 0.16, 0.07, "sine"); this.note(660, 0.11, 0.2, 0.07, "sine"); },
            win: () => { [0, 4, 7, 12, 16].forEach((s, i) => this.note(this.hz(s + 12), i * 0.09, 0.8, 0.08)); this.note(this.hz(24), 0.5, 1.1, 0.05, "sine"); }
        };
        if (m[name]) m[name]();
    }
    toggle(on) { this.note(on ? 660 : 440, 0, 0.08, 0.05, "sine"); this.note(on ? 880 : 330, 0.07, 0.1, 0.05, "sine"); }
    step(p, auto) { if (auto && (this.sk++ & 1)) return; this.note(this.scale(p), 0, 0.24, 0.07); }
    scan(p) { this.note(this.scale(p), 0, 0.12, 0.03, "sine"); }
    rank(r) { this.note(this.scale(1 - (r - 1) * 0.22), 0, 0.3, 0.1); }
}

/* ---------- Search algorithms (cells are indices r*cols+c) ---------- */
const newState = (N) => ({ par: new Int32Array(N).fill(-1), seen: new Uint8Array(N), mk: new Uint8Array(N), tm: new Float64Array(N), n: 0, last: -1, path: null });
const pathCost = (grid, path, weighted) => {
    if (!weighted) return path.length - 1;
    const C = grid[0].length; let t = 0;
    for (let i = 1; i < path.length; i++) t += COSTS[grid[(path[i] / C) | 0][path[i] % C]];
    return t;
};

function* search(name, grid, s0, goal, weighted, st, blocked) {
    const R = grid.length, C = grid[0].length, { par, seen, mk, tm } = st;
    const g = new Float32Array(R * C).fill(1e9), gr = (goal / C) | 0, gc = goal % C;
    const h = (k) => Math.abs(((k / C) | 0) - gr) + Math.abs((k % C) - gc);
    const cost = (k) => (weighted ? COSTS[grid[(k / C) | 0][k % C]] : 1);
    const heap = new MinHeap(), q = [s0]; let head = 0; g[s0] = 0;
    if (name === "Greedy" || name === "A*") heap.push([h(s0), s0]);
    const empty = () => (name === "BFS" ? head >= q.length : name === "DFS" ? !q.length : !heap.size);
    while (!empty()) {
        const u = name === "BFS" ? q[head++] : name === "DFS" ? q.pop() : heap.pop()[1];
        if (seen[u]) continue;
        seen[u] = 1; mk[u] = 0; st.n++; st.last = u; tm[u] = performance.now();
        if (u === goal) { const p = []; for (let x = goal; x >= 0; x = par[x]) p.push(x); st.path = p.reverse(); return; }
        const r = (u / C) | 0, c = u % C;
        for (const [dr, dc] of DIRS) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= R || nc < 0 || nc >= C || grid[nr][nc] === WALL) continue;
            const v = nr * C + nc;
            if (seen[v] || (blocked && blocked.has(v))) continue;
            if (name === "A*") { const ng = g[u] + cost(v); if (ng >= g[v]) continue; g[v] = ng; par[v] = u; heap.push([ng + h(v), v]); }
            else if (name === "Greedy") { if (par[v] >= 0 || v === s0) continue; par[v] = u; heap.push([h(v), v]); }
            else if (name === "BFS") { if (par[v] >= 0 || v === s0) continue; par[v] = u; q.push(v); }
            else { par[v] = u; q.push(v); }
            mk[v] = 1;
        }
        yield st;
    }
    st.path = [];
}

function solveInstant(name, grid, start, goal, weighted = false, blocked = null) {
    const C = grid[0].length, st = newState(grid.length * C);
    const t0 = performance.now();
    for (const _ of search(name, grid, start[0] * C + start[1], goal[0] * C + goal[1], weighted, st, blocked));
    const ms = performance.now() - t0, p = st.path;
    return { name, st, path: p, explored: st.n, length: p.length ? p.length - 1 : null, cost: p.length ? pathCost(grid, p, weighted) : null, timeMs: ms };
}

/* ---------- Maze generators ---------- */
function carve(rows, cols, prim) {
    const grid = Array.from({ length: rows }, () => Array(cols).fill(WALL));
    grid[1][1] = FREE;
    const J = [[-2, 0], [2, 0], [0, -2], [0, 2]];
    const ok = (r, c) => r >= 1 && r < rows - 1 && c >= 1 && c < cols - 1 && grid[r][c] === WALL;
    if (!prim) {
        const stack = [[1, 1]];
        while (stack.length) {
            const [r, c] = stack[stack.length - 1];
            const o = J.filter(([dr, dc]) => ok(r + dr, c + dc));
            if (o.length) {
                const [dr, dc] = o[rnd(o.length)];
                grid[r + dr / 2][c + dc / 2] = FREE; grid[r + dr][c + dc] = FREE; stack.push([r + dr, c + dc]);
            } else stack.pop();
        }
    } else {
        const f = [], add = (r, c) => J.forEach(([dr, dc]) => { if (ok(r + dr, c + dc)) f.push([r + dr, c + dc, r, c]); });
        add(1, 1);
        while (f.length) {
            const i = rnd(f.length); [f[i], f[f.length - 1]] = [f[f.length - 1], f[i]];
            const [nr, nc, pr, pc] = f.pop();
            if (grid[nr][nc] === WALL) { grid[nr][nc] = FREE; grid[(nr + pr) / 2][(nc + pc) / 2] = FREE; add(nr, nc); }
        }
    }
    return grid;
}

function addLoops(grid, fraction) {
    const R = grid.length, C = grid[0].length, cand = [];
    for (let r = 1; r < R - 1; r++) for (let c = 1; c < C - 1; c++) {
        if (grid[r][c] !== WALL) continue;
        const v = grid[r - 1][c] !== WALL && grid[r + 1][c] !== WALL && grid[r][c - 1] === WALL && grid[r][c + 1] === WALL;
        const hz = grid[r][c - 1] !== WALL && grid[r][c + 1] !== WALL && grid[r - 1][c] === WALL && grid[r + 1][c] === WALL;
        if (v || hz) cand.push([r, c]);
    }
    for (let i = cand.length - 1; i > 0; i--) { const j = rnd(i + 1); [cand[i], cand[j]] = [cand[j], cand[i]]; }
    cand.slice(0, Math.floor(cand.length * fraction)).forEach(([r, c]) => { grid[r][c] = FREE; });
}

function scatterTerrain(grid, start, goal) {
    const R = grid.length, C = grid[0].length, area = R * C;
    for (const [kind, count, maxRad] of [[GRASS, Math.max(3, Math.floor(area / 70)), 3], [MUD, Math.max(2, Math.floor(area / 100)), 2]]) {
        for (let n = 0; n < count; n++) {
            const r0 = rnd(R), c0 = rnd(C), rad = 1 + rnd(maxRad);
            for (let r = r0 - rad; r <= r0 + rad; r++) for (let c = c0 - rad; c <= c0 + rad; c++) {
                if (r >= 0 && r < R && c >= 0 && c < C && Math.abs(r - r0) + Math.abs(c - c0) <= rad && grid[r][c] === FREE &&
                    !(r === start[0] && c === start[1]) && !(r === goal[0] && c === goal[1])) grid[r][c] = kind;
            }
        }
    }
}

function generateMaze(rows, cols, mode = "Backtracker", loops = 0.1, terrain = true) {
    let grid, start, goal;
    if (mode === "Random walls") {
        start = [0, 0]; goal = [rows - 1, cols - 1];
        do {
            grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => (Math.random() < 0.28 ? WALL : FREE)));
            grid[0][0] = grid[rows - 1][cols - 1] = FREE;
        } while (!solveInstant("BFS", grid, start, goal).path.length);
    } else {
        const R = rows | 1, C = cols | 1;
        grid = carve(R, C, mode === "Prim"); addLoops(grid, loops);
        start = [1, 1]; goal = [R - 2, C - 2];
    }
    if (terrain) scatterTerrain(grid, start, goal);
    return { grid, start, goal };
}

function heatOf(grid, st) {
    const R = grid.length, C = grid[0].length, heat = new Float32Array(R * C);
    for (let k = 0; k < heat.length; k++) {
        if (!st.seen[k]) continue;
        heat[k]++;
        const r = (k / C) | 0, c = k % C;
        for (const [dr, dc] of DIRS) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < R && nc >= 0 && nc < C && grid[nr][nc] !== WALL) heat[nr * C + nc]++;
        }
    }
    return heat;
}
function heatColor(t) {
    const S = [[0, [70, 110, 220]], [0.33, [60, 200, 200]], [0.66, [250, 225, 70]], [1, [235, 60, 40]]];
    for (let i = 0; i < 3; i++) {
        const [t0, a] = S[i], [t1, b] = S[i + 1];
        if (t <= t1) { const k = (t - t0) / (t1 - t0); return `rgba(${a.map((v, j) => Math.round(v + (b[j] - v) * k)).join(",")},0.84)`; }
    }
    return "rgba(235,60,40,0.84)";
}

/* ---------- Application ---------- */
class MazeApp {
    constructor() {
        this.canvas = $("mazeCanvas"); this.ctx = this.canvas.getContext("2d");
        this.container = $("canvasContainer"); this.sound = new SoundEngine();
        this.rows = 21; this.cols = 33; this.cell = 20; this.ox = 0; this.oy = 0; this.W = 0; this.H = 0; this.dpr = 1;
        this.speed = 3; this.terrainOn = true; this.modeIdx = 0; this.brushIdx = 0;
        this.autoPlay = false; this.heatOn = false; this.dynamicOn = false; this.raceMode = false;
        this.obs = []; this.obsTick = 0; this.replanFlashUntil = 0;
        this.dead = false; this.deathPos = null;
        this.acoActive = false; this.ants = []; this.pheromone = null; this.acoGen = 0; this.acoBestPath = null; this.acoBestCost = Infinity;
        this.results = {}; this.racers = []; this.raceOver = false; this.raceSteps = 0; this.raceFastest = []; this.raceBest = []; this.hoverQuad = -1;
        this.dragging = null; this.playStats = null; this.winFlag = false; this.winT0 = 0; this.particles = []; this.charts = {};
        this.frame = 0; this._lt = 0; this._html = {};
        this.resetSearch();
        this._bindEvents(); this.resizeCanvas(); this.newRandom();
        requestAnimationFrame((t) => this.loop(t));
    }

    setHTML(id, html) { if (this._html[id] !== html) { this._html[id] = html; $(id).innerHTML = html; } }
    setBtn(id, label, key, on, cls = "on") {
        const b = $(id); b.innerHTML = key ? `${label} <i>[${key}]</i>` : label;
        b.classList.toggle(cls, on);
    }

    resizeCanvas() {
        const W = this.container.clientWidth, H = this.container.clientHeight;
        if (W < 50 || H < 50) return;
        const dpr = window.devicePixelRatio || 1;
        this.W = W; this.H = H; this.dpr = dpr;
        this.canvas.width = Math.round(W * dpr); this.canvas.height = Math.round(H * dpr);
        this.canvas.style.width = W + "px"; this.canvas.style.height = H + "px";
        this.cell = Math.max(5, Math.floor(Math.min((W - 16) / this.cols, (H - 16) / this.rows)));
        this.ox = Math.floor((W - this.cols * this.cell) / 2); this.oy = Math.floor((H - this.rows * this.cell) / 2);
    }

    flash(text, ms = 3500) {
        const el = $("toastMsg"); el.textContent = text; el.classList.remove("hidden");
        clearTimeout(this._tt); this._tt = setTimeout(() => el.classList.add("hidden"), ms);
    }

    resetSearch() {
        this.gen = null; this.st = null; this.path = null; this.algoName = "-"; this.done = false;
        this.walkIdx = null; this.walkF = 0; this.walkDone = false; this.wait = 0; this.runGrid = null;
        this.replans = 0; this.heatAcc = null;
        this.dead = false; this.deathPos = null;
        this.acoActive = false; this.ants = []; this.pheromone = null; this.acoGen = 0; this.acoBestPath = null; this.acoBestCost = Infinity;
        if (this._btnsReady) {
            this._updateAlgoButtons();
            this.renderTable();
        }
        this._updateExtraBox();
    }
    invalidate() { this.resetSearch(); this.results = {}; this.renderTable(); if (this.raceMode) this.startRace(); }

    newRandom() {
        const g = generateMaze(this.rows, this.cols, MAZE_MODES[this.modeIdx]);
        this.grid = g.grid; this.rows = g.grid.length; this.cols = g.grid[0].length; this.start = g.start; this.goal = g.goal;
        this.playStats = null; this.resizeCanvas(); this.respawnObstacles(); this.invalidate(); this.renderManualStats();
        this._btnsReady = true; this.sound.play("click");
    }
    cycleMode() { this.modeIdx = (this.modeIdx + 1) % 3; $("btn-mode").textContent = `Maze: ${MAZE_MODES[this.modeIdx]}`; this.newRandom(); }
    cycleSize() {
        const i = SIZES.findIndex(([r, c]) => r === this.rows && c === this.cols), n = SIZES[(i + 1) % SIZES.length];
        [this.rows, this.cols] = n; $("btn-size").textContent = `Size: ${n[0]}×${n[1]}`; this.newRandom();
    }
    clearAll() {
        this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(FREE));
        this.playStats = null; this.respawnObstacles(); this.invalidate(); this.renderManualStats(); this.sound.play("click");
    }
    toggleTerrain() {
        this.terrainOn = !this.terrainOn;
        this.setBtn("btn-terrain", `Terrain: ${this.terrainOn ? "ON" : "OFF"}`, "T", this.terrainOn);
        $("terrainBadge").textContent = this.terrainOn ? "Terrain ON" : "Terrain OFF";
        $("terrainBadge").className = this.terrainOn
            ? "text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
            : "text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-700 text-slate-300";
        $("terrainSub").textContent = this.terrainOn ? "Grass = 2, Mud = 5, Free = 1" : "Every step costs 1";
        this.playStats = null; this.invalidate(); this.renderManualStats(); this.sound.toggle(this.terrainOn);
    }
    cycleBrush() {
        this.brushIdx = (this.brushIdx + 1) % 3; const b = BRUSHES[this.brushIdx];
        $("btn-brush").textContent = `Brush: ${b.name}`;
        if (b.val !== WALL && !this.terrainOn) this.toggleTerrain();
        this.sound.play("click");
    }
    toggleSound() {
        this.sound.enabled = !this.sound.enabled;
        this.setBtn("btn-sound", `Sound: ${this.sound.enabled ? "ON" : "OFF"}`, "M", this.sound.enabled);
        if (this.sound.enabled) this.sound.toggle(true);
    }
    toggleAuto() { this.autoPlay = !this.autoPlay; this.setBtn("btn-auto", `Auto-Play: ${this.autoPlay ? "ON" : "OFF"}`, "P", this.autoPlay); this.sound.toggle(this.autoPlay); }
    toggleHeat() { this.heatOn = !this.heatOn; this.setBtn("btn-heat", `Heatmap: ${this.heatOn ? "ON" : "OFF"}`, "H", this.heatOn); this._updateExtraBox(); this.sound.toggle(this.heatOn); }
    toggleDynamic() {
        this.dynamicOn = !this.dynamicOn;
        this.setBtn("btn-dynamic", `Knights: ${this.dynamicOn ? "ON" : "OFF"}`, "O", this.dynamicOn, "on-o");
        this.respawnObstacles(); this.invalidate(); this._updateExtraBox(); this.sound.toggle(this.dynamicOn);
    }
    _updateExtraBox() {
        const d = this.dynamicOn && !this.raceMode, h = this.heatOn && !this.raceMode, a = this.acoActive && !this.raceMode;
        $("dynamicInfo").classList.toggle("hidden", !d);
        $("heatInfo").classList.toggle("hidden", !h);
        $("acoInfo").classList.toggle("hidden", !a);
        $("extraStatsBox").classList.toggle("hidden", !(d || h || a));
    }
    faster() { this.speed = Math.min(60, this.speed + 2); $("speedLabel").textContent = this.speed; this.sound.play("click"); }
    slower() { this.speed = Math.max(1, this.speed - 2); $("speedLabel").textContent = this.speed; this.sound.play("click"); }
    _updateAlgoButtons() {
        for (const n of ALGO_ORDER) $(`btn-${n}`).classList.toggle("on", this.algoName === n && !this.raceMode && !this.acoActive);
        $("btn-ACO").classList.toggle("on-c", this.acoActive && !this.raceMode);
    }

    /* ----- Ant Colony Optimization (ACO) ----- */
    startACO() {
        this._leaveRace();
        this.resetSearch();
        this.acoActive = true;
        this.algoName = "Ant Colony";
        this._updateAlgoButtons();
        this._updateExtraBox();
        const N = this.rows * this.cols;
        this.pheromone = new Float32Array(N).fill(0.15);
        this.acoGen = 1;
        this.acoBestPath = null;
        this.acoBestCost = Infinity;
        $("acoGen").textContent = "1";
        $("acoBest").textContent = "-";
        this._spawnAntWave(24);
        this.sound.play("click");
    }

    _spawnAntWave(count) {
        const sk = this.start[0] * this.cols + this.start[1];
        this.ants = Array.from({ length: count }, () => ({
            pos: sk,
            prev: -1,
            trail: [sk],
            visited: new Set([sk]),
            done: false,
            found: false
        }));
    }

    updateACO() {
        const R = this.rows, C = this.cols, gk = this.goal[0] * C + this.goal[1], gr = this.goal[0], gc = this.goal[1];
        const steps = Math.max(1, Math.floor(this.speed * 0.8));

        for (let s = 0; s < steps; s++) {
            let activeCount = 0;
            for (const ant of this.ants) {
                if (ant.done) continue;
                activeCount++;

                if (this.dynamicOn && this.obs.includes(ant.pos)) {
                    ant.done = true;
                    const [ax, ay] = this.cellCenter(ant.pos);
                    this.spawnConfetti(ax, ay, 8);
                    continue;
                }

                if (ant.pos === gk) {
                    ant.done = true;
                    ant.found = true;
                    const cost = pathCost(this.grid, ant.trail, this.terrainOn);
                    const deposit = Math.max(0.8, 180 / Math.max(1, cost));
                    for (const k of ant.trail) {
                        this.pheromone[k] = Math.min(8.0, this.pheromone[k] + deposit);
                    }
                    if (cost < this.acoBestCost) {
                        this.acoBestCost = cost;
                        this.acoBestPath = [...ant.trail];
                        this.path = this.acoBestPath;
                        $("acoBest").textContent = cost;
                        this.sound.play("tick", 0.08);
                    }
                    continue;
                }

                if (ant.trail.length > R * C * 0.7) {
                    ant.done = true;
                    continue;
                }

                const r = (ant.pos / C) | 0, c = ant.pos % C;
                const candidates = [];
                for (const [dr, dc] of DIRS) {
                    const nr = r + dr, nc = c + dc;
                    if (nr < 0 || nr >= R || nc < 0 || nc >= C || this.grid[nr][nc] === WALL) continue;
                    const nk = nr * C + nc;
                    if (this.dynamicOn && this.obs.includes(nk)) continue;
                    candidates.push(nk);
                }

                if (!candidates.length) { ant.done = true; continue; }

                let pool = candidates.filter((nk) => !ant.visited.has(nk));
                if (!pool.length) pool = candidates.filter((nk) => nk !== ant.prev);
                if (!pool.length) pool = candidates;

                let totalWeight = 0;
                const weights = pool.map((nk) => {
                    const tau = Math.pow(this.pheromone[nk], 1.4);
                    const dist = Math.abs(((nk / C) | 0) - gr) + Math.abs((nk % C) - gc) + 1;
                    const eta = Math.pow(1 / dist, 1.8);
                    const stepC = this.terrainOn ? COSTS[this.grid[(nk / C) | 0][nk % C]] : 1;
                    const w = (tau * eta) / stepC;
                    totalWeight += w;
                    return w;
                });

                let pick = Math.random() * totalWeight, chosen = pool[0];
                for (let i = 0; i < pool.length; i++) {
                    pick -= weights[i];
                    if (pick <= 0) { chosen = pool[i]; break; }
                }

                ant.prev = ant.pos;
                ant.pos = chosen;
                ant.trail.push(chosen);
                ant.visited.add(chosen);
                this.pheromone[chosen] = Math.min(8.0, this.pheromone[chosen] + 0.015);
            }

            if (activeCount === 0) {
                for (let i = 0; i < this.pheromone.length; i++) {
                    this.pheromone[i] = Math.max(0.08, this.pheromone[i] * 0.82);
                }
                this.acoGen++;
                $("acoGen").textContent = this.acoGen;
                this._spawnAntWave(24);
                break;
            }
        }
    }

    /* ----- single runs ----- */
    planGrid() {
        if (!this.dynamicOn || !this.obs.length) return this.grid;
        const g = this.grid.map((r) => [...r]);
        this.obs.forEach((k) => { g[(k / this.cols) | 0][k % this.cols] = WALL; });
        return g;
    }
    _leaveRace() { if (this.raceMode) { this.raceMode = false; this._syncRaceButtons(); this._updateExtraBox(); } }

    runAlgo(name) {
        this._leaveRace(); this.resetSearch(); this.algoName = name; this._updateAlgoButtons(); this._updateExtraBox();
        this.runGrid = this.grid;
        delete this.results[name];
        this.renderTable();
        if (this.autoPlay) {
            const r = solveInstant(name, this.grid, this.start, this.goal, this.terrainOn);
            this.results[name] = r; this.st = r.st; this.path = r.path; this.done = true; this.renderTable(); this.beginWalk();
        } else {
            this.st = newState(this.rows * this.cols);
            this.gen = search(name, this.grid, this.start[0] * this.cols + this.start[1], this.goal[0] * this.cols + this.goal[1], this.terrainOn, this.st);
        }
        this.sound.play("click");
    }
    beginWalk() {
        if (this.path && this.path.length) { this.walkIdx = 0; this.walkF = 0; this.walkDone = this.path.length === 1; }
    }
    compareAll() {
        this._leaveRace(); this.resetSearch();
        for (const n of ALGO_ORDER) this.results[n] = solveInstant(n, this.grid, this.start, this.goal, this.terrainOn);
        this.renderTable(); this.showResult("A*"); this.sound.play("click");
    }
    showResult(name) {
        const r = this.results[name]; if (!r) return;
        this._leaveRace(); this.resetSearch();
        this.algoName = name; this._updateAlgoButtons(); this.st = r.st; this.path = r.path; this.done = true; this.renderTable();
    }

    /* ----- race: four algorithms side by side ----- */
    toggleRace() { this.raceMode = !this.raceMode; this._syncRaceButtons(); this.raceMode ? this.startRace() : this.resetSearch(); this._updateExtraBox(); this.sound.play("click"); }
    _syncRaceButtons() {
        this.setBtn("btn-race", `Race Mode: ${this.raceMode ? "ON" : "OFF"}`, "Q", this.raceMode, "on-a");
        $("btn-restart-race").classList.toggle("hidden", !this.raceMode);
        this.canvas.style.cursor = this.raceMode ? "pointer" : "crosshair"; this._updateAlgoButtons();
    }
    startRace() {
        this.resetSearch(); this.results = {}; this.renderTable(); this.raceSteps = 0; this.raceOver = false; this.raceFastest = []; this.raceBest = [];
        const s = this.start[0] * this.cols + this.start[1], g = this.goal[0] * this.cols + this.goal[1];
        this.racers = ALGO_ORDER.map((name) => {
            const st = newState(this.rows * this.cols);
            return { name, st, gen: search(name, this.grid, s, g, this.terrainOn, st), done: false, finish: null, rank: null, res: null };
        });
    }
    updateRace() {
        if (this.raceOver) return;
        const steps = this.speed * Math.max(1, Math.floor((this.rows * this.cols) / 400));
        for (let s = 0; s < steps; s++) {
            this.raceSteps++;
            for (const rc of this.racers) if (!rc.done && rc.gen.next().done) this.finishRacer(rc);
            if (this.racers.every((r) => r.done)) { this.finishRace(); break; }
        }
    }
    finishRacer(rc) {
        rc.done = true; rc.finish = rc.st.n;
        rc.res = solveInstant(rc.name, this.grid, this.start, this.goal, this.terrainOn);
        this.results[rc.name] = rc.res; this.renderTable();
        if (rc.st.path.length) {
            rc.rank = 1 + this.racers.filter((o) => o !== rc && o.done && o.st.path.length && o.finish < rc.finish).length;
            this.sound.rank(rc.rank);
        }
    }
    finishRace() {
        this.raceOver = true;
        const ok = this.racers.filter((r) => r.st.path.length);
        if (!ok.length) return;
        const f = Math.min(...ok.map((r) => r.finish)), b = Math.min(...ok.map((r) => r.res.cost));
        this.raceFastest = ok.filter((r) => r.finish === f); this.raceBest = ok.filter((r) => r.res.cost === b);
        this.sound.play("win"); this.spawnConfetti(this.W / 2, this.H / 2, 80);
    }

    /* ----- dynamic Sword Knights + Lethal Collision ----- */
    respawnObstacles() {
        this.obs = [];
        if (!this.dynamicOn) return;
        const free = [], C = this.cols;
        for (let r = 0; r < this.rows; r++) for (let c = 0; c < C; c++) {
            if (this.grid[r][c] !== WALL && !(r === this.start[0] && c === this.start[1]) && !(r === this.goal[0] && c === this.goal[1]) &&
                Math.abs(r - this.start[0]) + Math.abs(c - this.start[1]) > 4) free.push(r * C + c);
        }
        for (let i = free.length - 1; i > 0; i--) { const j = rnd(i + 1); [free[i], free[j]] = [free[j], free[i]]; }
        this.obs = free.slice(0, Math.min(Math.max(4, Math.floor(free.length / 80)), free.length));
        $("obsCount").textContent = this.obs.length;
    }

    agentKey() {
        return this.walkIdx !== null && this.path && this.path.length
            ? this.path[this.walkIdx]
            : this.start[0] * this.cols + this.start[1];
    }

    triggerDeath(cellKey) {
        if (this.dead) return;
        this.dead = true;
        this.deathPos = cellKey;
        this.dragging = null;
        this.gen = null;
        if (ALGO_ORDER.includes(this.algoName)) {
            this.results[this.algoName] = {
                name: this.algoName,
                st: this.st,
                path: [],
                explored: this.st ? this.st.n : 0,
                length: null,
                cost: null,
                timeMs: 0,
                eliminated: true
            };
        }
        this.renderTable();
        this.sound.play("death");
        const [cx, cy] = this.cellCenter(cellKey);
        for (let i = 0; i < 65; i++) {
            const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 5.5;
            this.particles.push({
                x: cx, y: cy,
                vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5,
                life: 35 + rnd(35),
                color: ["#ef4444", "#dc2626", "#f97316", "#fbbf24"][rnd(4)]
            });
        }
        this.flash("💀 Eliminated by a Sword Knight! Press R or select an algorithm to retry.", 4500);
    }

    moveObstacles() {
        const C = this.cols, agent = this.agentKey(), goal = this.goal[0] * C + this.goal[1], occ = new Set(this.obs);
        this.obs = this.obs.map((k) => {
            const r = (k / C) | 0, c = k % C, o = [];
            for (const [dr, dc] of DIRS) {
                const nr = r + dr, nc = c + dc, nk = nr * C + nc;
                if (nr >= 0 && nr < this.rows && nc >= 0 && nc < C && this.grid[nr][nc] !== WALL && !occ.has(nk) && nk !== goal) o.push(nk);
            }
            if (o.length && Math.random() < 0.8) {
                const n = o[rnd(o.length)];
                occ.delete(k); occ.add(n);
                return n;
            }
            return k;
        });

        if (!this.dead && !this.reached && this.obs.includes(agent)) {
            this.triggerDeath(agent);
        }
    }

    nextBlocked() { return this.path.slice(this.walkIdx + 1, this.walkIdx + 4).some((k) => this.obs.includes(k)); }
    replan() {
        const C = this.cols, k = this.path[this.walkIdx];
        const r = solveInstant(this.algoName, this.planGrid(), [(k / C) | 0, k % C], this.goal, this.terrainOn);
        if (!r.path.length) return false;
        this.path = this.path.slice(0, this.walkIdx).concat(r.path);
        this.replans++; $("replanCount").textContent = this.replans; this.replanFlashUntil = performance.now() + 500;
        const h = heatOf(this.grid, r.st);
        if (!this.heatAcc) this.heatAcc = new Float32Array(h.length);
        for (let i = 0; i < h.length; i++) this.heatAcc[i] += h[i];
        this.sound.play("ping", 0.2); return true;
    }

    /* ----- manual play ----- */
    initManualPlay() {
        if (!this.playStats || this.playStats.end !== null)
            this.playStats = { origin: [...this.start], moves: 0, cost: 0, t0: null, end: null, opt: null };
    }
    countManualStep(r, c) {
        this.initManualPlay(); const p = this.playStats; if (p.end !== null) return;
        if (p.t0 === null) p.t0 = performance.now();
        p.moves++; p.cost += this.terrainOn ? COSTS[this.grid[r][c]] : 1;
        if (r === this.goal[0] && c === this.goal[1]) {
            p.end = performance.now(); p.opt = solveInstant("A*", this.grid, p.origin, this.goal, this.terrainOn).cost;
        }
        this.renderManualStats();
    }
    moveToken(which, tr, tc) {
        if (which === "start" && this.dead) return;
        let cur = which === "start" ? [...this.start] : [...this.goal], taken = 0, blocked = false;
        const C = this.cols;
        while (cur[0] !== tr || cur[1] !== tc) {
            if (which === "start" && cur[0] === this.goal[0] && cur[1] === this.goal[1]) break;
            const dr = Math.sign(tr - cur[0]), dc = Math.sign(tc - cur[1]);
            const order = Math.abs(tr - cur[0]) >= Math.abs(tc - cur[1]) ? [[dr, 0], [0, dc]] : [[0, dc], [dr, 0]];
            let stepped = false;
            for (const [sr, sc] of order) {
                if (!sr && !sc) continue;
                const nr = cur[0] + sr, nc = cur[1] + sc, nk = nr * C + nc;
                if (nr < 0 || nr >= this.rows || nc < 0 || nc >= C || this.grid[nr][nc] === WALL) continue;
                if (which === "goal" && (nr === this.start[0] && nc === this.start[1] || this.obs.includes(nk))) continue;

                if (which === "start" && this.dynamicOn && this.obs.includes(nk)) {
                    this.start = [nr, nc];
                    this.triggerDeath(nk);
                    return;
                }

                cur = [nr, nc]; taken++; stepped = true;
                if (which === "start") this.countManualStep(nr, nc);
                break;
            }
            if (!stepped) { blocked = true; break; }
        }
        if (taken) {
            if (which === "start") this.start = cur; else { this.goal = cur; this.playStats = null; this.renderManualStats(); }
            this.invalidate(); this.sound.play("tick", 0.04);
        } else if (blocked) this.sound.play("bump", 0.35);
    }
    paintCell(r, c, mode) {
        if ((r === this.start[0] && c === this.start[1]) || (r === this.goal[0] && c === this.goal[1])) return;
        const v = mode === "paint" ? BRUSHES[this.brushIdx].val : FREE;
        if (this.grid[r][c] === v) return;
        this.grid[r][c] = v;
        if (v === WALL) this.obs = this.obs.filter((k) => k !== r * this.cols + c);
        this.playStats = null; this.renderManualStats(); this.invalidate();
    }

    /* ----- save / load ----- */
    saveMaze() {
        const d = { rows: this.rows, cols: this.cols, grid: this.grid.map((r) => r.join("")), start: this.start, goal: this.goal, terrain_on: this.terrainOn };
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }));
        a.download = `maze_${this.rows}x${this.cols}.json`; a.click(); URL.revokeObjectURL(a.href);
        this.flash(`Saved ${a.download}`);
    }
    loadMaze(ev) {
        const file = ev.target.files[0]; if (!file) return;
        const rd = new FileReader();
        rd.onload = (e) => {
            try {
                const d = JSON.parse(e.target.result), grid = d.grid.map((r) => r.split("").map(Number));
                const R = grid.length, C = grid[0].length;
                if (R < 5 || R > 81 || C < 5 || C > 81 || grid.some((r) => r.length !== C)) throw new Error();
                const [sr, sc] = d.start, [gr, gc] = d.goal;
                if (grid[sr][sc] === WALL || grid[gr][gc] === WALL) throw new Error();
                this.rows = R; this.cols = C; this.grid = grid; this.start = d.start; this.goal = d.goal;
                if (typeof d.terrain_on === "boolean" && d.terrain_on !== this.terrainOn) this.toggleTerrain();
                $("btn-size").textContent = `Size: ${R}×${C}`;
                this.playStats = null; this.resizeCanvas(); this.respawnObstacles(); this.invalidate(); this.renderManualStats();
                this.flash(`Loaded ${file.name} (${R}×${C})`);
            } catch (err) { this.flash("Invalid maze JSON file."); }
        };
        rd.readAsText(file); ev.target.value = "";
    }

    /* ----- input ----- */
    _cell(e, clamp = false) {
        if (this.raceMode && !clamp) return null;
        const b = this.canvas.getBoundingClientRect();
        const c = Math.floor((e.clientX - b.left - this.ox) / this.cell), r = Math.floor((e.clientY - b.top - this.oy) / this.cell);
        if (clamp) return [Math.max(0, Math.min(this.rows - 1, r)), Math.max(0, Math.min(this.cols - 1, c))];
        return r >= 0 && r < this.rows && c >= 0 && c < this.cols ? [r, c] : null;
    }
    _quad(e) {
        const b = this.canvas.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top;
        if (x < 0 || y < 0 || x > this.W || y > this.H) return -1;
        return (y >= this.H / 2 ? 2 : 0) + (x >= this.W / 2 ? 1 : 0);
    }
    _bindEvents() {
        new ResizeObserver(() => this.resizeCanvas()).observe(this.container);
        this.canvas.addEventListener("contextmenu", (e) => e.preventDefault());
        this.canvas.addEventListener("mousedown", (e) => {
            if (this.raceMode) {
                const rc = this.racers[this._quad(e)];
                if (e.button === 0 && rc) { if (!rc.res) { rc.res = solveInstant(rc.name, this.grid, this.start, this.goal, this.terrainOn); this.results[rc.name] = rc.res; } this.showResult(rc.name); this.flash(`Inspecting ${rc.name}`); }
                return;
            }
            const cell = this._cell(e); if (!cell) return;
            const [r, c] = cell;
            if (e.button === 0) {
                if (r === this.start[0] && c === this.start[1] && !this.dead) { this.dragging = "start"; this.initManualPlay(); }
                else if (r === this.goal[0] && c === this.goal[1]) { this.dragging = "goal"; }
                else { this.dragging = "paint"; this.paintCell(r, c, "paint"); }
            } else if (e.button === 2) { this.dragging = "erase"; this.paintCell(r, c, "erase"); }
        });
        window.addEventListener("mousemove", (e) => {
            if (this.raceMode) { this.hoverQuad = this._quad(e); return; }
            if (!this.dragging) return;
            if (this.dragging === "start" || this.dragging === "goal") { const [r, c] = this._cell(e, true); this.moveToken(this.dragging, r, c); }
            else { const cell = this._cell(e); if (cell) this.paintCell(cell[0], cell[1], this.dragging); }
        });
        window.addEventListener("mouseup", () => { this.dragging = null; });
        window.addEventListener("keydown", (e) => {
            if (e.target.tagName === "INPUT") return;
            const k = e.key.toLowerCase();
            if (k === "escape") { this.closeChartModal(); return; }
            if (!$("chartModal").classList.contains("hidden")) return;
            const A = { b: "BFS", d: "DFS", g: "Greedy", a: "A*" }, MV = { arrowup: [-1, 0], arrowdown: [1, 0], arrowleft: [0, -1], arrowright: [0, 1] };
            if (A[k]) this.runAlgo(A[k]);
            else if (k === "n") this.startACO();
            else if (e.code === "Space") { e.preventDefault(); this.raceMode ? this.startRace() : this.compareAll(); }
            else if (k === "q") this.toggleRace(); else if (k === "r") this.newRandom(); else if (k === "c") this.clearAll();
            else if (k === "t") this.toggleTerrain(); else if (k === "m") this.toggleSound(); else if (k === "p") this.toggleAuto();
            else if (k === "h") this.toggleHeat(); else if (k === "o") this.toggleDynamic();
            else if (MV[k] && !this.raceMode && !this.dead) { e.preventDefault(); this.initManualPlay(); this.moveToken("start", this.start[0] + MV[k][0], this.start[1] + MV[k][1]); }
        });
    }

    /* ----- simulation ----- */
    get reached() { return !this.dead && (this.walkDone || (this.start[0] === this.goal[0] && this.start[1] === this.goal[1])); }

    walkStep() {
        if (this.dead) return false;
        const nextCell = this.path[this.walkIdx + 1];
        if (this.dynamicOn && this.obs.includes(nextCell)) {
            if (!this.replan()) {
                this.walkIdx++;
                this.triggerDeath(nextCell);
                return false;
            }
        } else if (this.dynamicOn && this.nextBlocked()) {
            this.replan();
        }

        this.walkIdx++;
        const curCell = this.path[this.walkIdx];
        if (this.dynamicOn && this.obs.includes(curCell)) {
            this.triggerDeath(curCell);
            return false;
        }

        const progress = this.walkIdx / Math.max(1, this.path.length - 1);
        if (this.autoPlay) {
            this.sound.step(progress, true);
            const [x, y] = this.cellCenter(curCell);
            for (let i = 0; i < 2; i++) this.particles.push({ x, y, vx: (Math.random() - 0.5) * 3, vy: -Math.random() * 2, life: 16, color: COLORS.confetti[rnd(5)] });
        } else this.sound.step(progress, false);
        if (this.walkIdx >= this.path.length - 1) {
            this.walkIdx = this.path.length - 1;
            this.walkDone = true;
            if (ALGO_ORDER.includes(this.algoName)) {
                this.results[this.algoName] = {
                    name: this.algoName,
                    st: this.st,
                    path: this.path,
                    explored: this.st ? this.st.n : 0,
                    length: this.path.length - 1,
                    cost: pathCost(this.grid, this.path, this.terrainOn),
                    timeMs: this.results[this.algoName] ? this.results[this.algoName].timeMs : 0,
                    completed: true
                };
                this.renderTable();
            }
        }
        return true;
    }

    advance(dt) {
        if (this.dead) return;
        this.walkF += (dt / 1000) * (this.autoPlay ? 46 : this.dynamicOn ? 9 : 18);
        while (!this.walkDone && !this.dead && this.walkF >= this.walkIdx + 1) {
            if (!this.walkStep()) {
                this.walkF = this.walkIdx;
                return;
            }
            this.wait = 0;
        }
        if (this.walkDone || this.dead) this.walkF = this.walkIdx;
    }

    cellCenter(k) { return [this.ox + (k % this.cols) * this.cell + this.cell / 2, this.oy + ((k / this.cols) | 0) * this.cell + this.cell / 2]; }
    spawnConfetti(cx, cy, n = 80) {
        for (let i = 0; i < n; i++) {
            const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 5;
            this.particles.push({ x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 45 + rnd(45), color: COLORS.confetti[rnd(5)] });
        }
    }
    updateParticles() {
        for (const p of this.particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.16; p.life--; }
        this.particles = this.particles.filter((p) => p.life > 0);
    }

    update(dt) {
        this.frame++;
        if (this.raceMode) { this.updateRace(); this.updateParticles(); this.updateStatusBanner(); return; }

        if (this.acoActive && !this.dead) {
            this.updateACO();
        } else {
            const searching = this.gen && !this.done && !this.dead;
            if (searching) {
                const steps = this.speed * Math.max(1, Math.floor((this.rows * this.cols) / 400));
                for (let s = 0; s < steps; s++) if (this.gen.next().done) { this.done = true; this.path = this.st.path; break; }
                if (!this.autoPlay && this.frame % 3 === 0 && this.st.last >= 0) {
                    const C = this.cols, l = this.st.last;
                    this.sound.scan(1 - (Math.abs((l / C | 0) - this.goal[0]) + Math.abs(l % C - this.goal[1])) / (this.rows + C));
                }
                if (this.done) {
                    const inst = solveInstant(this.algoName, this.runGrid, this.start, this.goal, this.terrainOn);
                    if (!this.dynamicOn) this.results[this.algoName] = inst;
                    else this.results[this.algoName] = { ...inst, pendingWalk: true };
                    this.renderTable(); this.beginWalk();
                }
            } else if (this.done && this.path && this.path.length && this.walkIdx !== null && !this.walkDone && !this.dead) {
                this.advance(dt);
            }
        }

        const isSearching = this.gen && !this.done;
        if (this.dynamicOn && !isSearching && this.frame % 8 === 0) this.moveObstacles();

        const reached = this.reached;
        if (reached && !this.winFlag) {
            this.sound.play("win"); this.winT0 = performance.now();
            const gk = this.goal[0] * this.cols + this.goal[1]; this.spawnConfetti(...this.cellCenter(gk), 90);
        }
        this.winFlag = reached;
        if (this.playStats && this.playStats.t0 !== null && this.playStats.end === null && !this.dead) this.renderManualStats();
        this.updateParticles(); this.updateStatusBanner();
    }

    /* ----- drawing ----- */
    baseColor(v) {
        if (v === WALL) return COLORS.wall;
        if (this.terrainOn) { if (v === GRASS) return COLORS.grass; if (v === MUD) return COLORS.mud; }
        return COLORS.free;
    }
    visitedColor(age) { return age >= 280 ? COLORS.visited : `rgba(70,130,230,${(0.45 * age / 280).toFixed(2)})`; }
    currentHeat() {
        if (!this.heatOn || !this.st) return null;
        const h = heatOf(this.grid, this.st);
        if (this.heatAcc) for (let i = 0; i < h.length; i++) h[i] += this.heatAcc[i];
        return h;
    }
    label(k, text) {
        if (this.cell < 13) return;
        const ctx = this.ctx, [x, y] = this.cellCenter(k);
        ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.max(10, Math.floor(this.cell * 0.65))}px Inter, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, x, y + 1);
    }

    drawKnight(k) {
        const ctx = this.ctx, [cx, cy] = this.cellCenter(k), r = Math.max(5, this.cell * 0.42);
        const swing = Math.sin(this.frame * 0.22) * 0.35;
        ctx.save();
        ctx.translate(cx, cy);

        ctx.beginPath();
        ctx.arc(0, 0, r * 1.15, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(225, 29, 72, 0.28)";
        ctx.fill();

        ctx.beginPath();
        ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
        ctx.fillStyle = "#334155";
        ctx.fill();
        ctx.lineWidth = Math.max(1.5, r * 0.16);
        ctx.strokeStyle = "#94a3b8";
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-r * 0.2, -r * 0.72);
        ctx.quadraticCurveTo(0, -r * 1.25, r * 0.35, -r * 0.65);
        ctx.fillStyle = "#e11d48";
        ctx.fill();

        ctx.fillStyle = "#fb7185";
        ctx.fillRect(-r * 0.42, -r * 0.16, r * 0.84, r * 0.22);

        ctx.save();
        ctx.translate(r * 0.58, r * 0.1);
        ctx.rotate(-0.45 + swing);
        ctx.fillStyle = "#f8fafc";
        ctx.beginPath();
        ctx.moveTo(-r * 0.12, 0);
        ctx.lineTo(-r * 0.12, -r * 1.15);
        ctx.lineTo(0, -r * 1.42);
        ctx.lineTo(r * 0.12, -r * 1.15);
        ctx.lineTo(r * 0.12, 0);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#fbbf24";
        ctx.fillRect(-r * 0.34, -r * 0.08, r * 0.68, r * 0.16);
        ctx.fillRect(-r * 0.1, r * 0.08, r * 0.2, r * 0.32);
        ctx.restore();

        ctx.restore();
    }

    draw() {
        const ctx = this.ctx;
        ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        ctx.fillStyle = COLORS.bg; ctx.fillRect(0, 0, this.W, this.H);
        if (this.raceMode) { this.drawRace(); this.drawParticles(); return; }

        const cell = this.cell, ox = this.ox, oy = this.oy, R = this.rows, C = this.cols, st = this.st, now = performance.now();
        const heat = this.currentHeat(); let mh = 1;
        if (heat) for (let i = 0; i < heat.length; i++) if (heat[i] > mh) mh = heat[i];
        $("heatPeak").textContent = mh + "x";
        let pm = null;
        if (this.path && this.path.length) { pm = new Int32Array(R * C).fill(-1); this.path.forEach((k, i) => { pm[k] = i; }); }
        const walking = this.walkIdx !== null && this.path && this.path.length > 0, lines = cell >= 9;
        ctx.lineWidth = 1; ctx.strokeStyle = COLORS.gridLine;

        for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
            const v = this.grid[r][c], k = r * C + c, x = ox + c * cell, y = oy + r * cell;
            ctx.fillStyle = this.baseColor(v); ctx.fillRect(x, y, cell, cell);
            if (v !== WALL) {
                const pi = pm ? pm[k] : -1; let col = null;
                if (pi >= 0) col = walking && pi > this.walkIdx ? COLORS.pathAhead : COLORS.path;
                else if (this.acoActive && this.pheromone && this.pheromone[k] > 0.16) {
                    const alpha = Math.min(0.82, (this.pheromone[k] - 0.15) * 0.35);
                    col = `rgba(34, 211, 238, ${alpha.toFixed(2)})`;
                } else if (st) {
                    if (heat) { const h = heat[k]; if (h) col = heatColor(mh <= 1 ? 0 : (h - 1) / (mh - 1)); }
                    else if (st.mk[k]) col = COLORS.frontier;
                    else if (st.seen[k]) col = this.visitedColor(now - st.tm[k]);
                }
                if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, cell, cell); }
            }
            if (lines) ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
        }

        if (this.acoActive && this.ants.length) {
            for (const ant of this.ants) {
                if (ant.done) continue;
                const [ax, ay] = this.cellCenter(ant.pos);
                ctx.beginPath();
                ctx.arc(ax, ay, Math.max(2.5, cell * 0.24), 0, Math.PI * 2);
                ctx.fillStyle = "#fef08a";
                ctx.fill();
            }
        }

        for (const k of this.obs) {
            this.drawKnight(k);
        }

        const gk = this.goal[0] * C + this.goal[1], sk = this.start[0] * C + this.start[1];
        const gx = ox + this.goal[1] * cell, gy = oy + this.goal[0] * cell;
        ctx.fillStyle = this.reached ? COLORS.gold : COLORS.goal; ctx.fillRect(gx, gy, cell, cell);
        this.label(gk, sk === gk && !this.dead ? "S" : "G");

        if (this.dead && this.deathPos !== null) {
            const [dx, dy] = this.cellCenter(this.deathPos);
            ctx.beginPath(); ctx.arc(dx, dy, Math.max(6, cell * 0.44), 0, Math.PI * 2);
            ctx.fillStyle = "#111827"; ctx.fill();
            ctx.lineWidth = 2.5; ctx.strokeStyle = "#ef4444"; ctx.stroke();
            if (cell >= 12) {
                ctx.fillStyle = "#ef4444"; ctx.font = `bold ${Math.max(10, Math.floor(cell * 0.62))}px Inter, sans-serif`;
                ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("✕", dx, dy + 0.5);
            }
        } else if (sk !== gk && !walking) {
            ctx.fillStyle = COLORS.start; ctx.fillRect(ox + this.start[1] * cell, oy + this.start[0] * cell, cell, cell);
            this.label(sk, "S");
        } else if (walking) {
            const a = this.cellCenter(this.path[this.walkIdx]), nx = this.path[Math.min(this.walkIdx + 1, this.path.length - 1)], b = this.cellCenter(nx);
            const t = this.walkIdx < this.path.length - 1 ? Math.max(0, Math.min(1, this.walkF - this.walkIdx)) : 0;
            const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t, rad = Math.max(4, cell / 2 - 2);
            ctx.save(); ctx.shadowColor = "#3ddc84"; ctx.shadowBlur = cell * 0.8;
            ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fillStyle = COLORS.start; ctx.fill();
            ctx.lineWidth = Math.max(2, cell / 12); ctx.strokeStyle = "#fff"; ctx.stroke(); ctx.restore();
            if (now < this.replanFlashUntil) { ctx.beginPath(); ctx.arc(x, y, rad + 4, 0, Math.PI * 2); ctx.strokeStyle = "#ff3c3c"; ctx.lineWidth = 3; ctx.stroke(); }
            if (cell >= 13) { ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.max(10, Math.floor(cell * 0.6))}px Inter, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("S", x, y + 1); }
        }

        const el = (now - this.winT0) / 1000;
        if (this.reached && el < 2) for (let k = 0; k < 2; k++) {
            ctx.beginPath(); ctx.arc(gx + cell / 2, gy + cell / 2, cell * (0.4 + (el * 1.8 + k * 0.8) % 1.6), 0, Math.PI * 2);
            ctx.strokeStyle = COLORS.gold; ctx.lineWidth = 3; ctx.stroke();
        }
        this.drawParticles();
    }

    drawRace() {
        const ctx = this.ctx, gap = 8, pw = Math.floor((this.W - gap) / 2), ph = Math.floor((this.H - gap) / 2), hh = 30;
        const R = this.rows, C = this.cols, cs = Math.max(3, Math.floor(Math.min((pw - 14) / C, (ph - hh - 12) / R))), now = performance.now();
        this.racers.forEach((rc, i) => {
            const rx = (i % 2) * (pw + gap), ry = Math.floor(i / 2) * (ph + gap), hover = this.hoverQuad === i, st = rc.st;
            ctx.save(); ctx.beginPath(); ctx.rect(rx, ry, pw, ph); ctx.clip();
            ctx.fillStyle = hover ? "#252936" : COLORS.panelBg; ctx.fillRect(rx, ry, pw, ph);
            ctx.fillStyle = "#141720"; ctx.fillRect(rx, ry, pw, hh);
            ctx.fillStyle = "#fff"; ctx.font = "bold 13px Inter, sans-serif"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
            ctx.fillText(rc.name, rx + 10, ry + hh / 2);
            const ok = rc.done && rc.res && rc.st.path.length;
            const isBest = this.raceOver && this.raceBest.includes(rc), isFast = this.raceOver && this.raceFastest.includes(rc);
            ctx.fillStyle = isBest ? COLORS.gold : "#cbd5e1"; ctx.font = "11px JetBrains Mono, monospace";
            ctx.fillText(ok ? `exp ${rc.finish} | steps ${rc.res.length} | cost ${rc.res.cost}` : rc.done ? "no path" : `exp ${st.n}`, rx + 66, ry + hh / 2);
            let right = rx + pw - 10;
            if (rc.rank) {
                const bx = rx + pw - 16, by = ry + hh / 2;
                ctx.beginPath(); ctx.arc(bx, by, 9.5, 0, Math.PI * 2); ctx.fillStyle = COLORS.ranks[Math.min(rc.rank, 4)]; ctx.fill();
                ctx.fillStyle = "#111827"; ctx.font = "bold 10px Inter, sans-serif"; ctx.textAlign = "center"; ctx.fillText(`#${rc.rank}`, bx, by + 0.5);
                right = bx - 14;
            }
            if ((isFast || isBest) && pw > 400) {
                const tag = isFast && isBest ? "FASTEST + BEST" : isFast ? "FASTEST" : "BEST PATH";
                ctx.font = "bold 10px Inter, sans-serif"; const tw = ctx.measureText(tag).width + 12;
                ctx.fillStyle = isBest ? "rgba(255,215,0,0.18)" : "rgba(56,189,248,0.2)"; ctx.fillRect(right - tw, ry + 5, tw, hh - 10);
                ctx.fillStyle = isBest ? COLORS.gold : "#38bdf8"; ctx.textAlign = "center"; ctx.fillText(tag, right - tw / 2, ry + hh / 2 + 0.5);
            } else if (hover && pw > 400) {
                ctx.fillStyle = "#94a3b8"; ctx.font = "10px Inter, sans-serif"; ctx.textAlign = "right"; ctx.fillText("Click to inspect", right, ry + hh / 2);
            }
            const mx = rx + Math.floor((pw - C * cs) / 2), my = ry + hh + Math.floor((ph - hh - R * cs) / 2), lines = cs >= 6;
            ctx.lineWidth = 1; ctx.strokeStyle = COLORS.gridLine;
            for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
                const v = this.grid[r][c], k = r * C + c, x = mx + c * cs, y = my + r * cs;
                ctx.fillStyle = this.baseColor(v); ctx.fillRect(x, y, cs, cs);
                if (v !== WALL) {
                    const col = st.mk[k] ? COLORS.frontier : st.seen[k] ? this.visitedColor(now - st.tm[k]) : null;
                    if (col) { ctx.fillStyle = col; ctx.fillRect(x, y, cs, cs); }
                }
                if (lines) ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
            }
            const p = st.path;
            if (p && p.length > 1) {
                ctx.lineCap = ctx.lineJoin = "round"; ctx.beginPath();
                p.forEach((k, j) => { const x = mx + (k % C) * cs + cs / 2, y = my + ((k / C) | 0) * cs + cs / 2; j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
                ctx.strokeStyle = "#1e1b0a"; ctx.lineWidth = Math.max(4, cs * 0.52); ctx.stroke();
                ctx.strokeStyle = COLORS.gold; ctx.lineWidth = Math.max(2, cs * 0.32); ctx.stroke();
            }
            for (const [pos, col, txt] of [[this.start, COLORS.start, "S"], [this.goal, COLORS.goal, "G"]]) {
                const x = mx + pos[1] * cs, y = my + pos[0] * cs;
                ctx.fillStyle = col; ctx.fillRect(x, y, cs, cs); ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5; ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
                if (cs >= 9) { ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.max(8, Math.floor(cs * 0.66))}px Inter, sans-serif`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(txt, x + cs / 2, y + cs / 2 + 0.5); }
            }
            ctx.restore();
            ctx.strokeStyle = rc.rank === 1 ? COLORS.gold : hover ? "#60a5fa" : COLORS.gridLine; ctx.lineWidth = rc.rank === 1 ? 3 : 1;
            ctx.strokeRect(rx + 1, ry + 1, pw - 2, ph - 2);
        });
    }
    drawParticles() { for (const p of this.particles) { this.ctx.fillStyle = p.color; this.ctx.fillRect(p.x, p.y, 5, 5); } }
    loop(t) {
        const dt = Math.min(50, this._lt ? t - this._lt : 16); this._lt = t;
        this.update(dt); this.draw();
        requestAnimationFrame((n) => this.loop(n));
    }

    /* ----- side panel and status ----- */
    renderTable() {
        const costs = Object.values(this.results).filter((r) => r && r.path && r.path.length && !r.eliminated && !r.pendingWalk).map((r) => r.cost);
        const best = costs.length ? Math.min(...costs) : null;
        this.setHTML("resultsBody", ALGO_ORDER.map((n) => {
            const r = this.results[n], sel = n === this.algoName && !this.raceMode && !this.acoActive;
            const row = sel ? "bg-blue-600/25 border-l-2 border-blue-400" : "hover:bg-slate-800/60";
            if (!r) return `<tr class="${row} text-slate-500"><td class="py-2 px-2.5 font-bold text-slate-300">${n}</td>${'<td class="py-2 px-1.5 text-right">-</td>'.repeat(4)}</tr>`;
            if (r.eliminated) {
                return `<tr class="${row} bg-rose-950/30"><td class="py-2 px-2.5 font-bold text-white">${n}</td>
                    <td class="py-2 px-1.5 text-right text-slate-300">${r.explored}</td>
                    <td class="py-2 px-2.5 text-right text-rose-400 font-bold" colspan="3">💀 DIED (No Goal)</td></tr>`;
            }
            if (r.pendingWalk) {
                return `<tr class="${row}"><td class="py-2 px-2.5 font-bold text-white">${n}</td>
                    <td class="py-2 px-1.5 text-right text-slate-300">${r.explored}</td>
                    <td class="py-2 px-2.5 text-right text-sky-400 font-semibold" colspan="3">🏃 Moving...</td></tr>`;
            }
            const has = r.path && r.path.length;
            return `<tr class="${row} cursor-pointer" onclick="app.showResult('${n}')"><td class="py-2 px-2.5 font-bold text-white">${n}</td>
                <td class="py-2 px-1.5 text-right">${r.explored}</td><td class="py-2 px-1.5 text-right">${has ? r.length : "-"}</td>
                <td class="py-2 px-1.5 text-right ${has ? (r.cost === best ? "text-amber-300 font-bold" : "text-slate-200") : "text-rose-400"}">${has ? (this.dynamicOn ? `✅ ${r.cost}` : r.cost) : "no path"}</td>
                <td class="py-2 px-2.5 text-right">${r.timeMs.toFixed(2)}</td></tr>`;
        }).join(""));
    }
    renderManualStats() {
        const p = this.playStats;
        if (!p) {
            this.setHTML("manualStats", `<p>Drag <span class="text-emerald-400 font-bold">S</span> to <span class="text-rose-400 font-bold">G</span> or use Arrow keys!</p><p>Moves, cost &amp; time are compared vs A*.</p>`);
            return;
        }
        const el = p.t0 === null ? 0 : ((p.end || performance.now()) - p.t0) / 1000;
        let h = `<div class="flex justify-between text-slate-200 mono"><span>Moves: <strong>${p.moves}</strong></span>${this.terrainOn ? `<span>Cost: <strong>${p.cost}</strong></span>` : ""}<span>Time: <strong>${el.toFixed(1)}s</strong></span></div>`;
        if (p.end !== null && p.opt) h += `<div class="pt-1 border-t border-slate-700 flex justify-between text-amber-300 font-bold mono"><span>Optimal Cost: ${p.opt}</span><span>Score: ${Math.min(100, Math.round(100 * p.opt / Math.max(1, p.cost)))}%</span></div>`;
        this.setHTML("manualStats", h);
    }
    updateStatusBanner() {
        let h;
        if (this.dead) {
            h = `<span class="text-rose-400">💀 S was eliminated by a Sword Knight! Press <strong>R</strong> or pick an algorithm to retry.</span>`;
        } else if (this.raceMode) {
            if (!this.raceOver) h = `🏁 Racing all 4 algorithms... expansions: <span class="text-blue-400">${this.raceSteps}</span> <span class="text-slate-400 text-xs">(click a box to inspect)</span>`;
            else if (this.raceFastest.length) h = `<span class="text-amber-300">🏆 Race Done! Fastest: ${this.raceFastest.map((r) => r.name).join(" / ")} (${this.raceFastest[0].finish} cells) • Best Cost: ${this.raceBest.map((r) => r.name).join(" / ")} (${this.raceBest[0].res.cost})</span>`;
            else h = `<span class="text-rose-400">Race finished: no path exists.</span>`;
        } else if (this.acoActive) {
            const bestTxt = this.acoBestPath ? `Best Path: ${this.acoBestPath.length - 1} steps (cost ${this.acoBestCost})` : "Scouts exploring...";
            h = `🐜 <span class="text-cyan-300">Ant Colony</span> &nbsp;|&nbsp; Wave: <span class="text-amber-300">${this.acoGen}</span> &nbsp;|&nbsp; ${bestTxt}`;
        } else if (this.reached && this.walkDone && this.path && this.path.length) {
            h = `<span class="text-amber-300">🎉 Goal reached! steps = ${this.path.length - 1} • explored = ${this.st.n} (${this.algoName})${this.dynamicOn ? ` • replans = ${this.replans}` : ""}</span>`;
        } else if (this.reached && this.playStats && this.playStats.end !== null) {
            h = `<span class="text-amber-300">🎉 Goal reached manually! moves = ${this.playStats.moves} • time = ${((this.playStats.end - this.playStats.t0) / 1000).toFixed(1)}s</span>`;
        } else {
            let s = "ready";
            if (this.path === null) s = this.gen && !this.done ? "searching..." : "ready";
            else if (!this.path.length) s = "no path found";
            else if (this.walkIdx !== null) s = `walking... steps = ${this.path.length - 1}` + (this.dynamicOn ? ` (replans: ${this.replans})` : "");
            else { const r = this.results[this.algoName]; s = r ? `steps = ${this.path.length - 1} • cost = ${r.cost}` : "path shown"; }
            h = `Algorithm: <span class="text-blue-400">${this.algoName}</span> &nbsp;|&nbsp; Explored: <span class="text-emerald-400">${this.st ? this.st.n : 0}</span> &nbsp;|&nbsp; ${s}`;
        }
        this.setHTML("statusBanner", h);
    }

    /* ----- benchmark charts (Chart.js) ----- */
    openChartModal() { $("chartModal").classList.remove("hidden"); this.runBenchmarkCharts(); }
    closeChartModal() { $("chartModal").classList.add("hidden"); }
    runBenchmarkCharts() {
        $("chartLoading").classList.remove("hidden"); $("chartsGrid").classList.add("hidden");
        if (typeof Chart === "undefined") { $("chartLoading").textContent = "Chart.js could not load. Check your internet connection."; return; }
        setTimeout(() => {
            const sizes = [11, 17, 23, 31, 41], runs = 6, data = {};
            ALGO_ORDER.forEach((n) => { data[n] = { explored: [], time: [], cost: [] }; });
            for (const sz of sizes) {
                const acc = {}; ALGO_ORDER.forEach((n) => { acc[n] = { e: 0, t: 0, c: 0 }; });
                for (let i = 0; i < runs; i++) {
                    const { grid, start, goal } = generateMaze(sz, sz, "Backtracker", 0.12, true);
                    for (const n of ALGO_ORDER) {
                        const a = solveInstant(n, grid, start, goal, false), b = solveInstant(n, grid, start, goal, true);
                        acc[n].e += a.explored; acc[n].t += a.timeMs; acc[n].c += b.cost || 0;
                    }
                }
                ALGO_ORDER.forEach((n) => { data[n].explored.push(+(acc[n].e / runs).toFixed(1)); data[n].time.push(+(acc[n].t / runs).toFixed(3)); data[n].cost.push(+(acc[n].c / runs).toFixed(1)); });
            }
            $("chartLoading").classList.add("hidden"); $("chartsGrid").classList.remove("hidden");
            const colors = { BFS: "#3b82f6", DFS: "#ef4444", Greedy: "#f59e0b", "A*": "#10b981" };
            const build = (id, key, title, yLabel) => {
                if (this.charts[id]) this.charts[id].destroy();
                this.charts[id] = new Chart($(id).getContext("2d"), {
                    type: "line",
                    data: { labels: sizes.map((s) => `${s}×${s}`), datasets: ALGO_ORDER.map((n) => ({ label: n, data: data[n][key], borderColor: colors[n], backgroundColor: colors[n], borderWidth: 2.5, tension: 0.25, pointRadius: 4 })) },
                    options: { responsive: true, plugins: { title: { display: true, text: title, color: "#f1f5f9", font: { size: 13, weight: "bold" } }, legend: { labels: { color: "#cbd5e1", boxWidth: 12 } } },
                        scales: { x: { ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.1)" } }, y: { title: { display: true, text: yLabel, color: "#94a3b8" }, ticks: { color: "#94a3b8" }, grid: { color: "rgba(148,163,184,0.1)" } } } }
                });
            };
            build("chartExplored", "explored", "Nodes Explored (Fewer = Better)", "Nodes");
            build("chartTime", "time", "Execution Time (Lower = Better)", "ms");
            build("chartCost", "cost", "Path Cost w/ Terrain (Lower = Better)", "Total Cost");
        }, 40);
    }
}

const app = new MazeApp();