/* Deterministic stage certificates and integer, full-material collision geometry.
 * A material bit represents the WHOLE unit square, never a point sample.
 * No packages or network access are required. See docs/certified-generation.md.
 */
(function (root, factory) {
  const engine = factory();
  if (typeof module === 'object' && module.exports) module.exports = engine;
  else root.TileEngine = engine;
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const N = 280, Q = 256, LIMIT = 65536, VERSION = 1;
  const integer = x => Number.isSafeInteger(x);
  function rng(seed) {
    let state = seed >>> 0;
    return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  }
  function hash(mask) {
    let value = 2166136261;
    for (const bit of mask) value = Math.imul(value ^ bit, 16777619) >>> 0;
    return value.toString(16).padStart(8, '0');
  }
  function barrierFor(lines) {
    const barrier = new Uint8Array(N * N);
    for (const line of lines) {
      let [x, y, endX, endY] = line.map(Math.round);
      const dx = Math.abs(endX - x), dy = -Math.abs(endY - y);
      const sx = x < endX ? 1 : -1, sy = y < endY ? 1 : -1;
      let error = dx + dy;
      for (;;) {
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
          const px = x + ox, py = y + oy;
          if (px >= 0 && py >= 0 && px < N && py < N) barrier[py * N + px] = 1;
        }
        if (x === endX && y === endY) break;
        const twice = error * 2;
        if (twice >= dy) { error += dy; x += sx; }
        if (twice <= dx) { error += dx; y += sy; }
      }
    }
    return barrier;
  }
  function regions(solid, lines) {
    const barrier = barrierFor(lines), labels = new Int32Array(N * N), parts = [];
    labels.fill(-1);
    const queue = new Int32Array(N * N);
    for (let i = 0; i < solid.length; i++) {
      if (!solid[i] || barrier[i] || labels[i] >= 0) continue;
      const id = parts.length;
      let head = 0, tail = 1, sumX = 0, sumY = 0;
      queue[0] = i; labels[i] = id;
      while (head < tail) {
        const p = queue[head++], x = p % N, y = Math.floor(p / N);
        sumX += x; sumY += y;
        for (const q of [x ? p - 1 : -1, x < N - 1 ? p + 1 : -1, y ? p - N : -1, y < N - 1 ? p + N : -1]) {
          if (q >= 0 && solid[q] && !barrier[q] && labels[q] < 0) { labels[q] = id; queue[tail++] = q; }
        }
      }
      parts.push({ size: tail, x: sumX / tail, y: sumY / tail });
    }
    return { labels, regions: parts, barrier };
  }
  function removalMask(solid, segmentation, id) {
    const doomed = new Uint8Array(N * N), { labels, barrier } = segmentation;
    for (let i = 0; i < solid.length; i++) if (labels[i] === id) doomed[i] = 1;
    for (let i = 0; i < solid.length; i++) if (solid[i] && barrier[i]) {
      const x = i % N, y = Math.floor(i / N);
      for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
        if (x + ox >= 0 && x + ox < N && y + oy >= 0 && y + oy < N && labels[i + oy * N + ox] === id) doomed[i] = 1;
      }
    }
    return doomed;
  }
  function profileCuts(breaks, heights) {
    const cuts = [];
    for (let i = 0; i < heights.length; i++) {
      const end = Math.min(N - 1, breaks[i + 1]);
      if (heights[i] > 0) cuts.push([breaks[i], heights[i], end, heights[i]]);
      if (i < heights.length - 1 && heights[i] !== heights[i + 1]) cuts.push([breaks[i + 1], heights[i], breaks[i + 1], heights[i + 1]]);
    }
    return cuts;
  }
  function profilePath(breaks, heights) {
    const points = [[0, heights[0] / N]];
    for (let i = 0; i < heights.length; i++) {
      points.push([breaks[i + 1] / N, heights[i] / N]);
      if (i < heights.length - 1) points.push([breaks[i + 1] / N, heights[i + 1] / N]);
    }
    return [...points, [1, 1], [0, 1]];
  }
  function candidate(seed, fallback = false) {
    const random = rng(seed), count = fallback ? 1 : 2 + Math.floor(random() * 3);
    const widths = Array(count).fill(44);
    let remaining = N - 44 * count;
    for (let i = 0; i < count - 1; i++) { const extra = Math.floor(random() * (remaining + 1)); widths[i] += extra; remaining -= extra; }
    widths[count - 1] += remaining;
    for (let i = count - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [widths[i], widths[j]] = [widths[j], widths[i]]; }
    const breaks = [0]; for (const width of widths) breaks.push(breaks[breaks.length - 1] + width);
    const levels = [0, ...Array.from({length:17},(_,i)=>28+i*7)], heights = [];
    for (let i = 0; i < count; i++) {
      const choices = levels.filter(h => !i || Math.abs(h - heights[i-1]) >= 28);
      heights.push(fallback ? 84 : choices[Math.floor(random() * choices.length)]);
    }
    if (!heights.some(Boolean)) heights[Math.floor(random() * count)] = 84;
    const clicks = [];
    for (let i = 0; i < count; i++) {
      if (!heights[i]) continue;
      let best = i;
      while (i + 1 < count && heights[i + 1] > 0) { i++; if (heights[i] > heights[best]) best = i; }
      clicks.push([Math.floor((breaks[best] + breaks[best + 1]) / 2), Math.floor(heights[best] / 2)]);
    }
    return { version: VERSION, seed: seed >>> 0, breaks, heights, cuts: profileCuts(breaks, heights), clicks, entry: 'up' };
  }
  // This verifier does NOT use the game's Bresenham rasterizer or region flood fill.
  // For certified axis-aligned cuts, a 3-cell stroke is an exact integer rectangle.
  function verify(puzzle) {
    const fail = reason => ({ ok: false, reason });
    if (!puzzle || puzzle.version !== VERSION || puzzle.entry !== 'up') return fail('rules');
    const { breaks, heights, cuts, clicks } = puzzle;
    if (!Array.isArray(breaks) || !Array.isArray(heights) || heights.length < 1 || heights.length > 4 || breaks.length !== heights.length + 1) return fail('profile');
    if (breaks[0] !== 0 || breaks[breaks.length - 1] !== N) return fail('bounds');
    for (let i = 0; i < heights.length; i++) {
      if (!integer(breaks[i]) || breaks[i + 1] - breaks[i] < 44 || !integer(heights[i]) || heights[i] < 0 || heights[i] > 140) return fail('features');
    }
    if (!heights.some(Boolean) || JSON.stringify(cuts) !== JSON.stringify(profileCuts(breaks, heights))) return fail('cut-plan');
    if (!Array.isArray(clicks) || clicks.length < 1 || clicks.length > 4) return fail('clicks');
    const barrier = new Uint8Array(N * N), material = new Uint8Array(N * N).fill(1);
    for (const [ax, ay, bx, by] of cuts) {
      if (![ax, ay, bx, by].every(integer) || (ax !== bx && ay !== by) || Math.hypot(bx - ax, by - ay) < 3) return fail('segment');
      for (let y = Math.max(0, Math.min(ay, by) - 1); y <= Math.min(N - 1, Math.max(ay, by) + 1); y++) {
        barrier.fill(1, y * N + Math.max(0, Math.min(ax, bx) - 1), y * N + Math.min(N, Math.max(ax, bx) + 2));
      }
    }
    for (const click of clicks) {
      if (!Array.isArray(click) || click.length !== 2 || !click.every(integer)) return fail('click');
      const [cx, cy] = click;
      if (cx < 0 || cx >= N || cy < 0 || cy >= N || !material[cy * N + cx] || barrier[cy * N + cx]) return fail('face');
      const face = new Uint8Array(N * N), pending = [cy * N + cx]; face[pending[0]] = 1;
      while (pending.length) {
        const at = pending.pop(), x = at % N, y = Math.floor(at / N);
        for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
          if (nx < 0 || nx >= N || ny < 0 || ny >= N) continue;
          const next = ny * N + nx;
          if (material[next] && !barrier[next] && !face[next]) { face[next] = 1; pending.push(next); }
        }
      }
      if (face[(N - 1) * N + Math.floor(N / 2)]) return fail('kept-face');
      const remove = face.slice();
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (material[y * N + x] && barrier[y * N + x]) {
        for (let ny = Math.max(0, y - 2); ny <= Math.min(N - 1, y + 2); ny++) {
          for (let nx = Math.max(0, x - 2); nx <= Math.min(N - 1, x + 2); nx++) if (face[ny * N + nx]) remove[y * N + x] = 1;
        }
      }
      for (let i = 0; i < material.length; i++) if (remove[i]) material[i] = 0;
    }
    const minima = [], profile = new Int16Array(N);
    for (let k = 0; k < heights.length; k++) profile.fill(heights[k], breaks[k], breaks[k + 1]);
    // This is the universal certificate: every column is a nonempty bottom tail
    // below its wall. Translating by (0,d), for ANY d>=0, cannot hit that wall.
    for (let x = 0; x < N; x++) {
      let first = 0; while (first < N && !material[first * N + x]) first++;
      if (first < profile[x] || first > 144) return fail('wall-or-grip');
      for (let y = first; y < N; y++) if (!material[y * N + x]) return fail('non-monotone');
      minima.push(first);
    }
    if (minima.reduce((sum, y) => sum + y, 0) < N * N * .06) return fail('trivial');
    // Also replay through the actual runtime, catching disagreement between the
    // independently written checker and gameplay face/removal semantics.
    const runtime = new Uint8Array(N * N).fill(1);
    for (const [x, y] of clicks) {
      const segmentation = regions(runtime, cuts), id = segmentation.labels[y * N + x];
      if (id < 0 || segmentation.regions.length < 2) return fail('runtime-face');
      const remove = removalMask(runtime, segmentation, id);
      for (let i = 0; i < runtime.length; i++) if (remove[i]) runtime[i] = 0;
    }
    for (let i = 0; i < runtime.length; i++) if (runtime[i] !== material[i]) return fail('runtime-disagreement');
    return { ok: true, mask: material, certificate: { version: VERSION, entry: 'up', minima, materialHash: hash(material), score: 1 } };
  }
  function generate(seed, attempts = 8) {
    if (!integer(seed) || seed < 0 || seed > 0xffffffff || !integer(attempts) || attempts < 0 || attempts > 8) throw Error('Invalid seed/budget');
    for (let attempt = 0; attempt <= attempts; attempt++) {
      const fallback = attempt === attempts;
      const recipeSeed = (seed + Math.imul(attempt, 0x9e3779b9)) >>> 0;
      const puzzle = candidate(recipeSeed, fallback), result = verify(puzzle);
      if (!result.ok) continue;
      return { ...puzzle, seed, recipeSeed, fallback, path: profilePath(puzzle.breaks, puzzle.heights), hints: puzzle.cuts.map(([x,y,a,b]) => [[x/N,y/N],[a/N,b/N]]), name: puzzle.heights.length > 2 ? '벽의 굴곡' : '벽 모서리', proof: result.certificate, target: result.mask };
    }
    throw Error('Certified fallback failed');
  }
  function rectangles(mask) {
    const result = [], active = new Map();
    for (let y = 0; y < N; y++) {
      const next = new Map();
      for (let x = 0; x < N;) {
        if (!mask[y * N + x]) { x++; continue; }
        const start = x; while (x < N && mask[y * N + x]) x++;
        const key = start + ':' + x, previous = active.get(key);
        const rect = previous || { x0: start * Q, x1: x * Q, y0: y * Q, y1: (y + 1) * Q };
        rect.y1 = (y + 1) * Q;
        if (!previous) result.push(rect);
        next.set(key, rect);
      }
      active.clear(); for (const [key, value] of next) active.set(key, value);
    }
    return result;
  }
  function walls(puzzle) {
    return puzzle.heights.map((h, i) => ({ x0: (i ? puzzle.breaks[i] : -LIMIT) * Q, x1: (i === puzzle.heights.length - 1 ? LIMIT : puzzle.breaks[i + 1]) * Q, y0: -LIMIT * Q, y1: h * Q }));
  }
  function validPosition(p) { return p && integer(p.x) && integer(p.y) && Math.abs(p.x) < LIMIT * Q / 2 && Math.abs(p.y) < LIMIT * Q / 2; }
  function hit(rects, obstacles, position) {
    if (!validPosition(position)) return true;
    for (const r of rects) for (const w of obstacles) {
      if (r.x0 + position.x < w.x1 && r.x1 + position.x > w.x0 && r.y0 + position.y < w.y1 && r.y1 + position.y > w.y0) return true;
    }
    return false;
  }
  function sweepFree(rects, obstacles, from, to) {
    if (!validPosition(from) || !validPosition(to)) return false;
    // Exact for an axis-aligned segment. For diagonal docking, this bounding
    // sweep is a conservative superset, so it may reject but can never miss a hit.
    for (const r of rects) for (const w of obstacles) {
      if (r.x0 + Math.min(from.x, to.x) < w.x1 && r.x1 + Math.max(from.x, to.x) > w.x0 && r.y0 + Math.min(from.y, to.y) < w.y1 && r.y1 + Math.max(from.y, to.y) > w.y0) return false;
    }
    return true;
  }
  function move(rects, obstacles, from, to) {
    if (!validPosition(from) || !validPosition(to) || hit(rects, obstacles, from)) return { position: { ...from }, contacts: [] };
    const position = { ...from }, contacts = [];
    for (const axis of ['x', 'y']) {
      const other = axis === 'x' ? 'y' : 'x';
      let delta = to[axis] - position[axis], obstacle = -1;
      for (const r of rects) for (let i = 0; i < obstacles.length; i++) {
        const w = obstacles[i];
        if (r[other+'0'] + position[other] >= w[other+'1'] || r[other+'1'] + position[other] <= w[other+'0']) continue;
        if (delta > 0) {
          const distance = w[axis+'0'] - r[axis+'1'] - position[axis];
          if (distance >= 0 && distance < delta) { delta = distance; obstacle = i; }
        } else if (delta < 0) {
          const distance = w[axis+'1'] - r[axis+'0'] - position[axis];
          if (distance <= 0 && distance > delta) { delta = distance; obstacle = i; }
        }
      }
      position[axis] += delta;
      if (obstacle >= 0) contacts.push({ obstacle, axis });
    }
    return { position, contacts };
  }
  function layoutProof(puzzle, layout) {
    const { width, height, size, home, target, rulerLength } = layout;
    if (![width,height,size,rulerLength,home.x,home.y,target.x,target.y].every(Number.isFinite) || size <= 0 || height < rulerLength + 12 || home.x !== target.x || home.y < target.y + size * Math.max(...puzzle.heights) / N) return { ok: false };
    const commands = [];
    for (const [x,y,a,b] of puzzle.cuts) {
      const angle = Math.atan2(b-y,a-x), midX = home.x + (x+a)/2/N*size, midY = home.y + (y+b)/2/N*size;
      const ruler = { x: midX-16*Math.sin(angle), y: midY+16*Math.cos(angle), angle };
      if (ruler.x < 24 || ruler.x > width-24 || ruler.y < 24 || ruler.y > height-23 || Math.hypot(a-x,b-y)/N*size <= 8 || Math.hypot(a-x,b-y)/N*size > rulerLength) return { ok: false };
      commands.push({ ruler, from: { x: home.x+x/N*size, y: home.y+y/N*size }, to: { x: home.x+a/N*size, y: home.y+b/N*size } });
    }
    const grip = { x: .5, y: .82 };
    const start = { x: home.x+grip.x*size, y: home.y+grip.y*size }, end = { x: target.x+grip.x*size, y: target.y+grip.y*size };
    if ([start,end].some(p=>p.x<0||p.x>width||p.y<0||p.y>height)) return { ok: false };
    return { ok: true, commands, grip, path: [{ ...home }, { ...target }] };
  }
  return { N, Q, VERSION, rng, hash, regions, removalMask, generate, verify, rectangles, walls, hit, sweepFree, move, layoutProof };
});
