const assert = require('node:assert/strict');
const path = require('node:path');
const E = require(process.argv[2] ? path.resolve(process.argv[2]) : '../public/games/tile-fit/tile-engine.js');
const { N, Q } = E;
const random = E.rng(0x31415926), seeds = [0, 1, 42, 0xffffffff];
while (seeds.length < 1024) seeds.push(Math.floor(random() * 0x100000000));
let fallbackCount = 0;
const signatures = new Set();
for (const seed of seeds) {
  const puzzle = E.generate(seed), checked = E.verify(puzzle);
  assert(checked.ok, `Seed ${seed}: ${checked.reason}`);
  assert.equal(checked.certificate.materialHash, puzzle.proof.materialHash);
  assert.deepEqual(checked.mask, puzzle.target);
  signatures.add(puzzle.proof.materialHash);
  fallbackCount += Number(puzzle.fallback);
  const material = E.rectangles(puzzle.target), walls = E.walls(puzzle);
  const start = { x: 0, y: N * Q * 4 }, goal = { x: 0, y: 0 };
  assert(E.sweepFree(material, walls, start, goal), `Seed ${seed}: full insertion sweep`);
  assert.deepEqual(E.move(material, walls, start, goal).position, goal);
  assert(!E.hit(material, walls, goal));
  assert(!E.sweepFree(E.rectangles(new Uint8Array(N*N).fill(1)), walls, start, goal), 'Uncut tile must be obstructed');
  // Check that rectangle compression preserves every complete material cell.
  if (seed === 0 || seed === 42) {
    const reconstructed = new Uint8Array(N*N);
    for (const r of material) for (let y = r.y0/Q; y < r.y1/Q; y++) for (let x = r.x0/Q; x < r.x1/Q; x++) reconstructed[y*N+x]++;
    assert.deepEqual(reconstructed, puzzle.target);
  }
}
assert(signatures.size > 900, 'Generated puzzles should have substantial geometric variety');
console.log(`PASS: 1024 seeds, independent certificates, full insertion sweeps; ${signatures.size} distinct materials; ${fallbackCount} fallbacks`);

const original = E.generate(42), clone = () => JSON.parse(JSON.stringify(original));
for (const mutate of [
  p => p.cuts.pop(),
  p => p.clicks = [],
  p => p.clicks[0] = [140,279],
  p => p.breaks[1] = -5,
  p => p.heights[0] = 281,
  p => p.entry = 'over-the-wall',
  p => p.version = 999,
]) {
  const bad = clone(); mutate(bad);
  assert.equal(E.verify(bad).ok, false, 'Corrupt certificates must fail closed');
}
for (const seed of [-1, NaN, 0x100000000, 1.1, '42']) assert.throws(() => E.generate(seed));
const fallback = E.generate(123, 0);
assert(fallback.fallback && E.verify(fallback).ok);
assert.equal(E.generate(42).proof.materialHash, original.proof.materialHash);
console.log('PASS: tampered plans rejected, seed replay stable, bounded-budget fallback certified');

const tile = [{ x0: 0, y0: 0, x1: Q, y1: Q }];
const thinWall = [{ x0: Q*5+1, x1: Q*5+2, y0: -Q, y1: Q*2 }];
const from = { x: 0, y: 0 }, to = { x: Q*10, y: 0 };
assert(!E.hit(tile, thinWall, from) && !E.hit(tile, thinWall, to));
assert.equal(E.sweepFree(tile, thinWall, from, to), false);
assert.equal(E.move(tile, thinWall, from, to).position.x, Q*4+1);
assert(E.sweepFree(tile, thinWall, from, { x: Q*4+1, y: 0 }));
console.log('PASS: a wall only 1/256 cell thick blocks a fast drag although both endpoints are clear');

// Compare the analytic axis solver against exhaustive unit moves on small
// INTEGER geometries. This reference never uses the solver's distance formula.
function oracleHit(rects, walls, p) {
  return rects.some(r => walls.some(w => Math.max(r.x0+p.x,w.x0)<Math.min(r.x1+p.x,w.x1)&&Math.max(r.y0+p.y,w.y0)<Math.min(r.y1+p.y,w.y1)));
}
function exhaustiveMove(rects, walls, a, b) {
  const p = { ...a };
  for (const axis of ['x','y']) {
    const step = Math.sign(b[axis]-p[axis]);
    while (p[axis] !== b[axis]) {
      const next = { ...p, [axis]: p[axis]+step };
      if (oracleHit(rects,walls,next)) break;
      p[axis] += step;
    }
  }
  return p;
}
const pick = (min,max) => min+Math.floor(random()*(max-min+1));
let cases = 0;
while (cases < 1000) {
  const rects = [{x0:0,y0:0,x1:pick(1,6),y1:pick(1,6)}];
  const walls = Array.from({length:3},()=>{const x=pick(-15,15),y=pick(-15,15);return{x0:x,y0:y,x1:x+pick(1,6),y1:y+pick(1,6)}});
  const a = {x:pick(-20,20),y:pick(-20,20)}, b = {x:pick(-20,20),y:pick(-20,20)};
  if (oracleHit(rects,walls,a)) continue;
  const moved = E.move(rects,walls,a,b).position;
  assert.deepEqual(moved,exhaustiveMove(rects,walls,a,b));
  assert(!oracleHit(rects,walls,moved));
  assert(E.sweepFree(rects,walls,a,{x:moved.x,y:a.y}));
  assert(E.sweepFree(rects,walls,{x:moved.x,y:a.y},moved));
  cases++;
}
assert.equal(E.sweepFree(tile,thinWall,{x:NaN,y:0},to),false);
assert(E.hit(tile,thinWall,{x:Number.MAX_SAFE_INTEGER,y:0}));
console.log('PASS: 1000 motion cases match an independent exhaustive integer oracle; invalid coordinates fail closed');
