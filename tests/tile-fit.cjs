// Dependency-free input regression checks. Canvas drawing is mocked, not browser-rendered.
// Run: node tests/tile-fit.cjs [path/to/index.html]
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const sourcePath = process.argv[2] || path.resolve(__dirname, '../public/games/tile-fit/index.html');
const engine = require(path.join(path.dirname(sourcePath), 'tile-engine.js'));
let testSeed=1000;
const viewport = { width: 390, height: 627 };
const elements = new Map();
const animationFrames=[];
const drawing = new Proxy({
  createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
  createLinearGradient: () => ({ addColorStop() {} }),
}, { get: (target, key) => key in target ? target[key] : () => {} });

function element(id) {
  if (!elements.has(id)) {
  const classes=new Set(),attributes={};elements.set(id, {
    hidden: ['#help-sheet', '#success'].includes(id),
    style: {}, dataset: {}, attributes, firstChild: {}, handlers: {}, captures: new Set(),
    classList: { add(k){classes.add(k)}, remove(k){classes.delete(k)}, contains(k){return classes.has(k)}, toggle(k,on){if(on??!classes.has(k))classes.add(k);else classes.delete(k)} },
    getContext: () => drawing,
    getBoundingClientRect: () => ({ left: 0, top: 0, ...viewport }),
    addEventListener(type, handler) { this.handlers[type] = handler; },
    setPointerCapture(id) { this.captures.add(id); },
    hasPointerCapture(id) { return this.captures.has(id); },
    releasePointerCapture(id) { this.captures.delete(id); },
    setAttribute(k,v){attributes[k]=String(v)}, focus() {},
  });}
  return elements.get(id);
}

const sandbox = {
  console, Uint8Array, Uint8ClampedArray, Int32Array, Math, TileEngine:engine, URLSearchParams,
  crypto:{getRandomValues(a){a[0]=testSeed++;return a}},
  performance: { now: () => 5000 }, navigator: {},
  window: { devicePixelRatio: 2, location:{search:'?seed=42'}, addEventListener() {} },
  document: {
    querySelector: selector => element(selector),
    querySelectorAll: () => [],
    createElement: () => element(Symbol('canvas')),
  },
  ResizeObserver: class { observe() {} },
  requestAnimationFrame(callback){animationFrames.push(callback)}, setTimeout() {}, clearTimeout() {},
};
vm.createContext(sandbox);
const source = fs.readFileSync(sourcePath, 'utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
vm.runInContext(source, sandbox);
const run = expression => vm.runInContext(expression, sandbox);
run('sound=false');

function insidePolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a[1] > y) !== (b[1] > y) && x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function assertNoWallOverlap() {
  const { size, floorBottom, n } = run('({size:S,floorBottom:sceneBottom,n:N})');
  const walls = run('wallPolys()');
  for(const entry of run('storeTile();tiles.map(t=>({tile:t.pos,material:t.solid}))')){
  const {tile,material}=entry;if(tile.y>=floorBottom)continue;
  // Independent of the game's collision cache. Ignore less than one world pixel
  // at a rasterised edge, but inspect the material throughout the tile.
  for (let y = 0; y < n; y += 2) for (let x = 0; x < n; x += 2) {
    if (!material[y * n + x]) continue;
    const px = tile.x + (x + .5) / n * size, py = tile.y + (y + .5) / n * size;
    for (const wall of walls) {
      if (!insidePolygon(px, py, wall)) continue;
      const nearEdge = wall.some((a, i) => {
        const b = wall[(i + 1) % wall.length], dx = b[0] - a[0], dy = b[1] - a[1];
        const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / (dx * dx + dy * dy)));
        return Math.hypot(px - a[0] - t * dx, py - a[1] - t * dy) < .8;
      });
      assert(nearEdge, `Tile overlaps a wall at (${px.toFixed(1)}, ${py.toFixed(1)})`);
    }
  }
  }
}
function input(type, p, id = 1, pointerType = 'touch') {
  element('#game').handlers[type]({
    clientX: p.x * viewport.width / run('W'),
    clientY: p.y * viewport.height / run('H'),
    pointerId: id, pointerType, button: 0, preventDefault() {},
  });
  if (type === 'pointermove') assertNoWallOverlap();
}

const tilePoint = (u, v) => run(`({x:tile.x+S*${u},y:tile.y+S*${v}})`);
function moveRuler(target) {
  const current=run('({...ruler})'), length=run('rulerLength()/2-17');
  if(Math.abs(Math.sin(current.angle-target.angle))>1e-6||Math.cos(current.angle-target.angle)<0){
    let sign=1;
    let handle={x:current.x+length*Math.cos(current.angle),y:current.y+length*Math.sin(current.angle)};
    if(handle.x<0||handle.x>run('W')||handle.y<0||handle.y>run('H')){
      sign=-1;handle={x:current.x-length*Math.cos(current.angle),y:current.y-length*Math.sin(current.angle)};
    }
    input('pointerdown',handle);assert.equal(run('drag?.type'),'rotate');
    input('pointermove',{x:current.x+sign*length*Math.cos(target.angle),y:current.y+sign*length*Math.sin(target.angle)});
    input('pointerup',run('pointer'));
  }
  const from=run('({...ruler})');
  input('pointerdown',from);assert.equal(run('drag?.type'),'ruler');
  input('pointermove',target);input('pointerup',run('pointer'));
}
function parkTools() {
  run('animate(5300)');
  moveRuler(run('({x:W/2-15,y:H-26,angle:0})'));
}

function drawCut(a, b) {
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  const ruler = {
    x: (a.x + b.x) / 2 - 16 * Math.sin(angle),
    y: (a.y + b.y) / 2 + 16 * Math.cos(angle), angle,
  };
  run('animate(5300)');moveRuler(ruler);
  pencilStroke([a,b]);
}
function tap(u, v) {
  const p = tilePoint(u, v);
  input('pointerdown', p);
  input('pointerup', p);
}
function cutStage(index,seed) {
  run(`initLevel(${index},false${seed===undefined?'':','+seed})`);
  assert.equal(run('layoutBlocked'),false,'Certified controls fit the viewport');
  run('hint=true');
  const hints = run('stages[stage].hints');
  for (const [a, b] of hints) drawCut(tilePoint(...a), tilePoint(...b));
  parkTools();
  for (const p of run('stages[stage].clicks')) tap(p[0]/engine.N,p[1]/engine.N);
  assert.equal(run('Geometry.score(solid,targetMask).fit'),1,'Actual pen and face inputs reproduce the certified material');
}

// Use small pointer moves: a single jump to the goal hides intervening collision bugs.
function dragPath(waypoints) {
  const grip = tilePoint(.4, .6), origin = run('({...tile})');
  let previous = origin, maxLag = 0;
  input('pointerdown', grip);
  assert.equal(run('drag?.type'), 'tile', 'Pick up the visible tile');
  outer: for (const next of waypoints) {
    const steps = Math.ceil(Math.hypot(next.x - previous.x, next.y - previous.y) / 3);
    for (let i = 1; i <= steps; i++) {
      const x = previous.x + (next.x - previous.x) * i / steps;
      const y = previous.y + (next.y - previous.y) * i / steps;
      input('pointermove', { x: grip.x + x - origin.x, y: grip.y + y - origin.y });
      if (run('phase') !== 'play') break outer;
      const actual = run('tile');
      maxLag = Math.max(maxLag, Math.hypot(actual.x - x, actual.y - y));
    }
    previous = next;
  }
  input('pointerup', run('pointer'));
  return maxLag;
}


function gripForTile(id){
 return run(`(()=>{storeTile();const t=tiles.find(t=>t.id===${id});
  for(const v of [.08,.3,.6,.9,.97])for(const u of [.04,.2,.4,.6,.8,.96]){
   const p={x:t.pos.x+S*u,y:t.pos.y+S*v};
   if(p.x>2&&p.x<W-2&&p.y>2&&p.y<H-2&&objectAt(p)==='tile'&&tileAt(p).id===t.id)return p;
  }return null})()`);
}
function dragTileTo(id,target){
 const grip=gripForTile(id);assert(grip,`Tile ${id+1} must have a visible grab point`);
 const origin=run(`({...tiles.find(t=>t.id===${id}).pos})`);
 input('pointerdown',grip);assert.equal(run('drag?.type'),'tile');assert.equal(run('activeTileId'),id);
 input('pointermove',{x:grip.x+target.x-origin.x,y:grip.y+target.y-origin.y});input('pointerup',run('pointer'));
}
function clearWorkbench(){
 dragTileTo(1,run('({x:-125,y:home.y+24})'));
 dragTileTo(2,run('({x:W-85,y:home.y+24})'));
 // Return focus to the front tile without changing its position or material.
 const p=gripForTile(0);input('pointerdown',p);input('pointerup',p);
}
function pencilStroke(points,expected){
 if(!run('penMode'))element('#pen-toggle').onclick();
 assert.equal(run('penMode'),true);input('pointerdown',points[0]);assert.equal(run('drag?.type'),'pen');
 for(const [i,p]of points.entries()){
  if(i)input('pointermove',p);
  if(i===0&&expected){assert.equal(run('stroke?.guide?.kind'),expected.kind);assert.equal(run('stroke?.tileId'),expected.receiver);if(expected.owner!==undefined)assert.equal(run('stroke?.guide?.tileId'),expected.owner)}
 }
 input('pointerup',points.at(-1));element('#pen-toggle').onclick();assert.equal(run('penMode'),false);
}
function moveTriangle(target){
 run('animate(5300)');const current=run('({...triangle})'),vertex=run('triangleVertices()[1]');
 if(Math.abs(target.angle-current.angle)>.0001){
  input('pointerdown',vertex);assert.equal(run('drag?.type'),'triangle-rotate');
  const dx=vertex.x-current.x,dy=vertex.y-current.y,delta=target.angle-current.angle;
  input('pointermove',{x:current.x+dx*Math.cos(delta)-dy*Math.sin(delta),y:current.y+dx*Math.sin(delta)+dy*Math.cos(delta)});input('pointerup',run('pointer'));
 }
 const from=run('({...triangle})');
 const grip=run('(()=>{const l=triangleLength()/2-10,c=Math.cos(triangle.angle),s=Math.sin(triangle.angle);return{x:triangle.x-l*c-l*s,y:triangle.y-l*s+l*c}})()');
 input('pointerdown',grip);assert.equal(run('drag?.type'),'triangle');
 input('pointermove',{x:grip.x+target.x-from.x,y:grip.y+target.y-from.y});input('pointerup',run('pointer'));
}

let failures = 0;
function check(name, fn) {
  if(process.env.TILE_TEST_FILTER&&!name.includes(process.env.TILE_TEST_FILTER))return;
  try { fn(); console.log('PASS:', name); }
  catch (error) { failures++; console.error('FAIL:', name, '—', error.message); }
}

check('Freehand rendering keeps the triangle visible and animation alive through reset and new puzzle',()=>{
 Object.assign(viewport,{width:390,height:650});run('resize();initLevel(0,false,42)');
 animationFrames.length=0;
 run('var savedTriangleDraw=drawTriangle,trianglePaints=0;drawTriangle=function(){trianglePaints++;savedTriangleDraw()}');
 const tick=()=>{assert.equal(animationFrames.length,1,'Exactly one next frame must be scheduled');animationFrames.shift()(5000)};
 try{
  run('requestAnimationFrame(animate)');tick();const before=run('trianglePaints');
  element('#pen-toggle').onclick();const p=tilePoint(.5,.5);input('pointerdown',p);
  assert.equal(run('stroke.guide'),null,'Reproduce a freehand stroke away from guides');
  let error;try{tick()}catch(e){error=e}
  const painted=run('trianglePaints')>before,alive=animationFrames.length===1;
  element('#reset').onclick();const resetAlive=animationFrames.length===1;
  assert(painted&&alive&&resetAlive,`triangle repainted=${painted}; next frame=${alive}; restart frame=${resetAlive}; error=${error?.stack||'none'}`);
  tick();element('#skip').onclick();element('#new-puzzle').onclick();tick();element('#skip').onclick();
  // Drawing can resume after the same reset/new-puzzle actions reported by the user.
  element('#pen-toggle').onclick();input('pointerdown',tilePoint(.5,.5));tick();
  input('pointermove',tilePoint(.6,.6));tick();input('pointerup',tilePoint(.6,.6));tick();
  element('#pen-toggle').onclick();assert(run('lines.length>0'));
  const old=run('({...tile})');dragTileTo(run('activeTileId'),{x:old.x+25,y:old.y});tick();
  assert(run('tile.x')>old.x+15,'Canvas input and rendering both remain responsive');
 }finally{run('drawTriangle=savedTriangleDraw');animationFrames.length=0}
});

check('A cut tile can overhang the left screen edge and return to its certified entry', () => {
  cutStage(0,0x9e3779b9);
  dragPath([run('({x:-S*.2,y:home.y})')]);
  assert(run('tile.x<-.1*S'));
  dragPath([run('({...home})')]);
  assert(dragPath([run('({...targetPos})')])<20);
  assert.equal(run('phase'),'docking');
});

check('Random stages reproduce the certificate with real ruler, pen, face and tile inputs', () => {
  for(const [i,seed] of [0,1,42,123456789,0xffffffff,0x9e3779b9].entries()){
    cutStage(i,seed);
    assert(dragPath([run('({...targetPos})')])<20,`Seed ${seed}: clear vertical entry`);
    assert.equal(run('phase'),'docking',`Seed ${seed}: fits during drag`);
  }
});

check('A fast pointer jump cannot take an uncut tile through a wall', () => {
  run('initLevel(0,false,42)');parkTools();
  const grip=tilePoint(.4,.6),offset=run('({x:targetPos.x-tile.x,y:targetPos.y-tile.y})');
  input('pointerdown',grip);input('pointermove',{x:grip.x+offset.x,y:grip.y+offset.y});
  assert.equal(run('phase'),'play');assertNoWallOverlap();input('pointerup',run('pointer'));
});

check('The opening demonstration stops against walls in every stage', () => {
  for (let stage = 0; stage < 4; stage++) {
    run(`initLevel(${stage},true,${(stage*123456789+42)>>>0})`);
    for (let elapsed = 0; elapsed <= 1800; elapsed += 40) {
      run(`animate(introStart+${elapsed})`);
      assertNoWallOverlap();
    }
    assert.equal(run('phase'), 'play');
  }
});

for (const [width, height] of [[320, 430], [390, 650], [430, 790], [768, 700]]) {
  check(`Four certified random stages: continuous drag and fit in a ${width}×${height} playfield`, () => {
    Object.assign(viewport, { width, height });
    run('resize()');
    for (let i = 0; i < 4; i++) {
      cutStage(i,(i*123456789+42)>>>0);
      const lag = dragPath([run('({...targetPos})')]);
      assert(lag < 20, `Stage ${i + 1} blocked during drag`);
      assert.equal(run('phase'), 'docking', `Stage ${i + 1} must fit`);
      for (let elapsed = 0; elapsed <= 400; elapsed += 50) {
        run(`animate(animationStart+${elapsed})`);
        assertNoWallOverlap();
      }
      assert.equal(run('phase'), 'success');
    }
  });
}

check('Walls stop an uncut tile instead of letting it pass over them', () => {
  run('initLevel(3,false,42)'); parkTools();
  assert(dragPath([run('({...targetPos})')]) > 20, 'An uncut tile must stop at the wall');
  assert.equal(run('phase'), 'play');
});

check('Tile edge snapping still attracts nearby and releases when dragged away', () => {
  run('initLevel(1,false,42)'); parkTools();
  const pos = run('({x:targetPos.x+6,y:targetPos.y+S*.8})');
  dragPath([pos]);
  assert(Math.abs(run('tile.x-targetPos.x')) < .01);
  dragPath([{ x: pos.x + 28, y: pos.y }]);
  assert(run('tile.x-targetPos.x>20'), 'The tile must release from the snapped edge');
});

check('Hover and touch preview exactly the removed face; dragging preserves material', () => {
  cutStage(0,42); run('undo()'); parkTools();
  const click=run('stages[stage].clicks.at(-1)');
  const p = tilePoint(click[0]/engine.N,click[1]/engine.N);
  input('pointermove', p, 1, 'mouse');
  assert(run('previewMask!==null'));
  const preview = Array.from(run('previewMask')), before = Array.from(run('solid'));
  input('pointerdown', p);
  input('pointermove', { x: p.x + 25, y: p.y + 30 });
  assert.equal(run('previewMask'), null);
  input('pointerup', run('pointer'));
  assert.deepEqual(Array.from(run('solid')), before, 'Dragging must not remove the face');
  tap(click[0]/engine.N,click[1]/engine.N);
  const after = Array.from(run('solid'));
  for (let i = 0; i < before.length; i++) assert.equal(before[i] - after[i], preview[i]);
  run('undo()');
  assert.deepEqual(Array.from(run('solid')), before);
});

check('Restart keeps the seed; next/new puzzle generate fresh certified rounds beyond four', () => {
  run('initLevel(0,false,42)');
  const first=run('stages[stage].proof.materialHash');
  element('#reset').onclick();assert.equal(run('stage'),0);assert.equal(run('stages[stage].proof.materialHash'),first);
  for(let i=1;i<=7;i++){
    element('#new-puzzle').onclick();assert.equal(run('stage'),i);
    assert(engine.verify(run('stages[stage]')).ok);
  }
  element('#next').onclick();assert.equal(run('stage'),8);
});

check('Reflow preserves a certified stage, cancels drags, and restores play after a tiny viewport', () => {
  run('initLevel(0,false,42)');
  parkTools();input('pointerdown',tilePoint(.4,.6));
  assert.equal(run('drag?.type'),'tile');
  Object.assign(viewport,{width:390,height:80});run('resize()');
  assert.equal(run('layoutBlocked'),true);assert.equal(run('drag'),null);
  Object.assign(viewport,{width:390,height:650});run('resize()');
  assert.equal(run('layoutBlocked'),false);assert.equal(run('stages[stage].seed'),42);
  run('finishIntro()');cutStage(0);
  dragPath([run('({...targetPos})')]);assert.equal(run('phase'),'docking');
});

check('Resizing during automatic docking keeps the tile at the new target without crossing walls', () => {
  cutStage(0,42);dragPath([run('({...targetPos})')]);
  assert.equal(run('phase'),'docking');
  const material=run('stages[stage].proof.materialHash');
  for(const [width,height] of [[320,430],[430,790]]){
    Object.assign(viewport,{width,height});run('resize()');
    assert.equal(run('layoutBlocked'),false);
    assert.equal(run('stages[stage].proof.materialHash'),material);
    run('animate(animationStart+150)');assertNoWallOverlap();
    assert(run('Math.hypot(tile.x-targetPos.x,tile.y-targetPos.y)<.001'));
  }
  run('animate(animationStart+400)');assert.equal(run('phase'),'success');
});

check('Three identical independent tiles are directly reachable and reset together',()=>{
 Object.assign(viewport,{width:390,height:650});run('resize();initLevel(0,false,42)');
 assert.equal(run('tiles.length'),3);
 const full=engine.hash(new Uint8Array(engine.N*engine.N).fill(1));
 assert.deepEqual(Array.from(run('tiles.map(t=>TileEngine.hash(t.solid))')),[full,full,full]);
 assert(run('tiles.every((a,i)=>tiles.every((b,j)=>i===j||(a.solid!==b.solid&&a.canvas!==b.canvas)))'));
 for(const id of [0,1,2])assert(gripForTile(id),`Tile ${id+1} is exposed in the starting stack`);
 clearWorkbench();drawCut(tilePoint(0,.4),tilePoint(.999,.4));parkTools();tap(.5,.2);
 assert(run('tiles.find(t=>t.id===0).solid.some(v=>!v)'));
 assert.equal(run('tiles.find(t=>t.id===1).solid.every(Boolean)'),true);
 assert.equal(run('tiles.find(t=>t.id===2).solid.every(Boolean)'),true);
 element('#reset').onclick();assert(run('tiles.every(t=>t.lines.length===0&&t.solid.every(Boolean))'));
});

check('A cut tile guides ink onto the lower tile, can be cut again, and undo follows the correct tile',()=>{
 run('initLevel(0,false,42)');clearWorkbench();
 drawCut(tilePoint(0,.4),tilePoint(.999,.4));parkTools();tap(.5,.2);
 const guideMask=run('TileEngine.hash(solid)');
 dragTileTo(1,run('({x:home.x,y:home.y-30})'));
 const p=gripForTile(0);input('pointerdown',p);input('pointermove',{x:p.x+18,y:p.y});input('pointermove',p);input('pointerup',p);
 const guide=run('templateEdges(tiles.find(t=>t.id===0)).filter(e=>Math.abs(e.a.y-e.b.y)<.001).sort((a,b)=>a.a.y-b.a.y)[0]');
 const mid={x:(guide.a.x+guide.b.x)/2,y:guide.a.y};
 pencilStroke([mid,guide.a,guide.b],{kind:'template',receiver:1,owner:0});
 assert.equal(run('tiles.find(t=>t.id===1).lines.length'),1);
 assert.equal(run('TileEngine.hash(tiles.find(t=>t.id===0).solid)'),guideMask);
 assert.equal(run('tiles.find(t=>t.id===0).lines.length'),1);
 assert.equal(run('tiles.find(t=>t.id===2).lines.length'),0);
 parkTools();const tapPoint=run('({x:tile.x+S*.5,y:tile.y+S*.2})');
 input('pointermove',tapPoint,1,'mouse');assert.equal(run('previewTileId'),1);const preview=Array.from(run('previewMask'));
 input('pointerdown',tapPoint);input('pointerup',tapPoint);
 const after=Array.from(run('tiles.find(t=>t.id===1).solid'));
 for(let i=0;i<after.length;i++)assert.equal(1-after[i],preview[i]);
 run('undo()');assert.equal(run('activeTileId'),1);assert(run('solid.every(Boolean)'));
 // Bring the original guide back to the top and make another real cut in it.
 const g=gripForTile(0);input('pointerdown',g);input('pointermove',{x:g.x+18,y:g.y});input('pointermove',g);input('pointerup',g);
 drawCut(tilePoint(0,.75),tilePoint(.999,.75));assert.equal(run('activeTileId'),0);assert.equal(run('lines.length'),2);
 run('undo()');assert.equal(run('activeTileId'),0);assert.equal(run('lines.length'),1);assert.equal(run('TileEngine.hash(solid)'),guideMask);
 run('undo()');assert.equal(run('activeTileId'),1);assert.equal(run('lines.length'),0);assert(run('solid.every(Boolean)'));
});

check('A diagonal becomes a template edge only after its neighbouring face is removed',()=>{
 Object.assign(viewport,{width:390,height:650});run('resize();initLevel(0,false,42)');clearWorkbench();
 drawCut(tilePoint(0,0),tilePoint(.999,.999));parkTools();
 assert.equal(run('templateEdges(tiles.find(t=>t.id===0)).some(e=>Math.abs(e.a.x-e.b.x)>10&&Math.abs(e.a.y-e.b.y)>10)'),false);
 tap(.75,.15);const before=run('TileEngine.hash(solid)');
 dragTileTo(1,run('({x:home.x,y:home.y-30})'));
 const p=gripForTile(0);input('pointerdown',p);input('pointermove',{x:p.x+18,y:p.y});input('pointermove',p);input('pointerup',p);
 const guide=run('templateEdges(tiles.find(t=>t.id===0)).find(e=>Math.abs(e.a.x-e.b.x)>10&&Math.abs(e.a.y-e.b.y)>10)');
 assert(guide,'A real smooth diagonal edge remains after removal');
 pencilStroke([{x:(guide.a.x+guide.b.x)/2,y:(guide.a.y+guide.b.y)/2},guide.a,guide.b],{kind:'template',receiver:1,owner:0});
 const line=run('tiles.find(t=>t.id===1).lines[0]');assert(line);assert(Math.abs((line[2]-line[0])-(line[3]-line[1]))<=1);
 assert.equal(run('TileEngine.hash(tiles.find(t=>t.id===0).solid)'),before);
});

check('Every tile can be cut and automatically fitted, with no dedicated guide or answer role',()=>{
 for(const id of [0,1,2]){
  run('initLevel(0,false,42);hint=true');
  dragTileTo(id,run('({x:home.x,y:home.y-30})'));
  assert.equal(run('activeTileId'),id);
  for(const[a,b]of run('stages[stage].hints'))drawCut(tilePoint(...a),tilePoint(...b));
  parkTools();for(const p of run('stages[stage].clicks'))tap(p[0]/engine.N,p[1]/engine.N);
  assert.equal(run('activeTileId'),id);assert.equal(run('Geometry.score(solid,targetMask).fit'),1);
  dragPath([run('({...targetPos})')]);assert.equal(run('phase'),'docking');assert.equal(run('activeTileId'),id);
 }
});

for(const [width,height]of [[320,430],[390,650]])check(`Triangle body, rotation handles and all three cutting edges work at ${width}×${height}`,()=>{
 Object.assign(viewport,{width,height});run('resize();initLevel(0,false,42)');clearWorkbench();parkTools();
 moveTriangle(run('({x:home.x+S*.5,y:home.y+S*.45,angle:Math.PI/2})'));
 assert(Math.abs(run('Math.sin(triangle.angle-Math.PI/2)'))<.001);
 moveTriangle(run('({x:home.x+S*.5,y:home.y+S*.45,angle:0})'));
 const edges=run('triangleEdges()');
 for(const e of edges){
  // Start exactly at the shared vertex; movement must choose the intended side.
  pencilStroke([e.a,e.b],{kind:'triangle',receiver:0});
 }
 assert.equal(run('lines.length'),3);assert(run('seg.regions.length>=2'),'Three finite edges enclose a removable face');
 moveTriangle(run('trianglePark()'));parkTools();
 const p={x:edges.reduce((sum,e)=>sum+e.a.x,0)/3,y:edges.reduce((sum,e)=>sum+e.a.y,0)/3};
 input('pointermove',p,1,'mouse');assert.equal(run('previewTileId'),0);assert(run('previewMask!==null'));
 input('pointerdown',p);input('pointerup',p);assert(run('solid.some(v=>!v)'));
 run('undo()');assert(run('solid.every(Boolean)'));assert.equal(run('lines.length'),3);
});

check('The triangle snaps to a tile edge, releases, and supports two-finger move/rotation',()=>{
 Object.assign(viewport,{width:390,height:650});run('resize();initLevel(0,false,42)');clearWorkbench();parkTools();
 moveTriangle(run('({x:tile.x+triangleLength()/2+5,y:tile.y+S*.5,angle:0})'));
 assert(Math.abs(run('triangleVertices()[0].x-tile.x'))<.001);
 const before=run('({...triangle})');moveTriangle({...before,x:before.x+28});
 assert(run('triangleVertices()[0].x-tile.x>20'));
 const a=run('triangleVertices()[0]'),b=run('triangleVertices()[1]'),pose=run('({...triangle})');
 // First finger on the solid frame, then a second finger on a vertex.
 const p={x:a.x+10,y:a.y-10};input('pointerdown',p,1);assert.equal(run('drag?.type'),'triangle');
 input('pointerdown',b,2);assert.equal(run('gesture?.tool'),'triangle');
 input('pointermove',{x:b.x+28,y:b.y+18},2);
 assert(Math.abs(run('triangle.angle')-pose.angle)>.03);
 assert(Math.hypot(run('triangle.x')-pose.x,run('triangle.y')-pose.y)>4);
 input('pointerup',p,1);input('pointerup',run('pointer'),2);assert.equal(run('gesture'),null);
});

check('Reflow preserves all three independent materials and returns every tile from a tiny layout',()=>{
 run('initLevel(0,false,42)');dragTileTo(1,run('({x:home.x,y:home.y-30})'));
 drawCut(tilePoint(0,.4),tilePoint(.999,.4));parkTools();tap(.5,.2);
 const before=Array.from(run('storeTile();tiles.slice().sort((a,b)=>a.id-b.id).map(t=>TileEngine.hash(t.solid))'));
 Object.assign(viewport,{width:320,height:430});run('resize()');assertNoWallOverlap();
 assert.deepEqual(Array.from(run('tiles.slice().sort((a,b)=>a.id-b.id).map(t=>TileEngine.hash(t.solid))')),before);
 Object.assign(viewport,{width:390,height:80});run('resize()');assert.equal(run('layoutBlocked'),true);
 Object.assign(viewport,{width:390,height:650});run('resize()');assert.equal(run('layoutBlocked'),false);assertNoWallOverlap();
 assert.deepEqual(Array.from(run('tiles.slice().sort((a,b)=>a.id-b.id).map(t=>TileEngine.hash(t.solid))')),before);
 for(const id of [0,1,2])assert(gripForTile(id),`Tile ${id+1} is still reachable after resume`);
});

check('The pen button toggles direct freehand input; a coalesced curved loop previews, removes and undoes as one stroke',()=>{
 Object.assign(viewport,{width:390,height:650});run('resize();initLevel(0,false,42)');clearWorkbench();parkTools();
 const origin=run('({...tile})'),center=tilePoint(.5,.5),radius=run('S*.21');
 const points=Array.from({length:49},(_,i)=>({x:center.x+radius*Math.cos(i*Math.PI/24),y:center.y+radius*Math.sin(i*Math.PI/24)}));
 points.at(-1).x+=4;points.at(-1).y+=3; // Near closure receives a small endpoint snap.
 element('#pen-toggle').onclick();assert.equal(run('penMode'),true);
 assert.equal(element('#pen-toggle').attributes['aria-pressed'],'true');assert(element('#pen-toggle').classList.contains('on'));
 input('pointerdown',points[0]);assert.equal(run('drag?.type'),'pen');assert.equal(run('stroke.guide'),null);
 const event=p=>({clientX:p.x*viewport.width/run('W'),clientY:p.y*viewport.height/run('H'),pointerId:1,pointerType:'touch',button:0,preventDefault(){}});
 element('#game').handlers.pointermove({...event(points.at(-1)),getCoalescedEvents:()=>points.slice(1).map(event)});
 assert(run('stroke.points.length>40'),'Retain intermediate curved input, not only the final pointer position');
 assert.equal(run('stroke.guide'),null);input('pointerup',points.at(-1));
 assert.equal(run('history.length'),1);assert.equal(run('cuts'),1);assert(run('lines.length>20'));assert.equal(run('seg.regions.length'),2);
 assert.deepEqual(run('({...tile})'),origin,'Drawing must not move a tile');
 // A tap in pen mode is ink input, not a destructive face tap.
 input('pointerdown',center);input('pointerup',center);assert(run('solid.every(Boolean)'));assert.equal(run('history.length'),1);
 element('#pen-toggle').onclick();assert.equal(run('penMode'),false);assert.equal(element('#pen-toggle').attributes['aria-pressed'],'false');
 input('pointermove',center,1,'mouse');assert.equal(run('previewTileId'),0);
 const preview=Array.from(run('previewMask')),area=preview.reduce((a,b)=>a+b,0)/preview.length;assert(area>.08&&area<.25);
 input('pointerdown',center);input('pointerup',center);
 const after=Array.from(run('solid'));for(let i=0;i<after.length;i++)assert.equal(1-after[i],preview[i]);
 run('undo()');assert(run('solid.every(Boolean)'));assert(run('lines.length>20'));
 run('undo()');assert.equal(run('lines.length'),0);assert.equal(run('history.length'),0);
});

check('A single stroke can leave a ruler for freehand; cancel discards partial ink and reset clears the mode',()=>{
 run('initLevel(0,false,42)');clearWorkbench();parkTools();
 moveRuler(run('({x:tile.x+S*.5,y:tile.y+S*.35+16,angle:0})'));
 const points=[[.1,.35],[.5,.35],[.58,.62],[.68,.72],[.82,.6]].map(p=>tilePoint(...p));
 element('#pen-toggle').onclick();input('pointerdown',points[0]);assert.equal(run('stroke.guide.kind'),'ruler');
 input('pointermove',points[1]);input('pointermove',points[2]);assert.equal(run('stroke.guide'),null);
 for(const p of points.slice(3))input('pointermove',p);input('pointerup',points.at(-1));
 assert.equal(run('history.length'),1);assert.equal(run('cuts'),1);assert(run('Math.max(...lines.flatMap(l=>[l[1],l[3]]))-Math.min(...lines.flatMap(l=>[l[1],l[3]]))>N*.2'));
 run('undo()');assert.equal(run('lines.length'),0);
 const a=tilePoint(.3,.7),b=tilePoint(.4,.8);input('pointerdown',a);input('pointermove',b);input('pointercancel',b);
 assert.equal(run('stroke'),null);assert.equal(run('lines.length'),0);assert.equal(run('history.length'),0);assert.equal(run('penMode'),true);
 element('#reset').onclick();assert.equal(run('penMode'),false);assert.equal(element('#pen-toggle').attributes['aria-pressed'],'false');
 assert(run('tiles.every(t=>t.lines.length===0&&t.solid.every(Boolean))'));
});

process.exitCode = failures ? 1 : 0;
