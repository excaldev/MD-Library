/* Cinematic UI Demo — motion engine.
   Copy this whole file into a <script> tag in the artifact. It has no
   dependencies and expects:
     - a cursor element:  <img id="cursor" class="cursor" src="...">  (position: fixed/absolute, left/top in px)
     - a camera wrapper:  <div id="camera" class="camera">...scene...</div>  (transform-origin set per move)
   Everything is driven by requestAnimationFrame, not CSS transitions, so
   cursor paths can arc and easing can be mixed per-step. */

const Easing = {
  linear: t => t,
  inOutCubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  outBack: t => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  outElastic: t => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  }
};

function raf(durationMs, onFrame) {
  return new Promise(resolve => {
    const start = performance.now();
    function tick(now) {
      const t = Math.min(1, (now - start) / durationMs);
      onFrame(t);
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
}

/* Moves the cursor toward a target with intent: a small, consistent arc for
   organic feel, never large or randomized enough to read as wandering.
   from/to are {x, y} in the SAME coordinate space as the cursor's
   offsetParent. bow controls how much the path curves (px) — kept modest
   and proportional to distance rather than randomized per-move. */
function moveCursor(cursorEl, from, to, duration = 700, opts = {}) {
  const easing = opts.easing || Easing.inOutCubic;
  const bow = opts.bow ?? (Math.hypot(to.x - from.x, to.y - from.y) * 0.08);
  const mx = (from.x + to.x) / 2 - bow * (opts.bowFlip ? -1 : 1);
  const my = (from.y + to.y) / 2 - Math.abs(bow);
  return raf(duration, t => {
    const e = easing(t);
    const x = (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * mx + e * e * to.x;
    const y = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * my + e * e * to.y;
    cursorEl.style.left = x + 'px';
    cursorEl.style.top = y + 'px';
  });
}

/* Since the cursor is a simulated image, real CSS :hover never fires on
   it — call these explicitly the instant a cursor move finishes arriving
   at a target, and the moment it's about to leave, so hover-equivalent
   feedback (see .is-hovered in the skill doc) stays honest to what's
   actually happening on screen. */
function cursorArrive(el, cls = 'is-hovered') { el.classList.add(cls); }
function cursorLeave(el, cls = 'is-hovered') { el.classList.remove(cls); }

/* A brief scale-up-then-settle, for the moment an element should visibly
   react to interaction — arrival, or right after a successful click.
   Distinct from pressCursor/releaseCursor, which animate the cursor
   icon itself, not the target element. */
async function growPulse(el, scale = 1.06, duration = 140) {
  el.style.transition = `transform ${duration}ms ease-out`;
  el.style.transform = `scale(${scale})`;
  await new Promise(r => setTimeout(r, duration));
  el.style.transition = `transform ${duration}ms ease-in`;
  el.style.transform = 'scale(1)';
  await new Promise(r => setTimeout(r, duration));
}

/* A slow, continuous, very small scale oscillation — use this while the
   camera is HOLDING on something (a button being considered, a field
   mid-typing) so the hold doesn't read as a frozen frame. Subtle: this is
   a "still breathing" cue, not a pulse anyone should consciously notice.
   Returns a stop function; call it right before the real interaction
   (press/click/type) begins so the two motions don't fight each other. */
function idleBreathe(el, opts = {}) {
  const amp = opts.amplitude ?? 0.015;
  const period = opts.period ?? 1400;
  let running = true;
  const start = performance.now();
  function frame(now) {
    if (!running) return;
    const t = (now - start) / period;
    const s = 1 + Math.sin(t * Math.PI * 2) * amp;
    el.style.transform = `scale(${s})`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return () => { running = false; el.style.transform = ''; };
}

/* Smoothly animates width/height/border-radius (NOT just a scale
   transform) so an element can genuinely reshape itself — a button
   growing into a status pill, a card expanding into a panel — rather than
   just getting visually bigger. Requires the element to have an explicit
   starting width/height (px) already set or measurable via
   getBoundingClientRect; grabs that automatically if not provided. */
function morphSize(el, to, duration = 400, easing = 'cubic-bezier(.4,0,.2,1)') {
  const from = el.getBoundingClientRect();
  if (!el.style.width) el.style.width = from.width + 'px';
  if (!el.style.height) el.style.height = from.height + 'px';
  el.style.transition = `width ${duration}ms ${easing}, height ${duration}ms ${easing}, border-radius ${duration}ms ${easing}`;
  requestAnimationFrame(() => {
    if (to.width != null) el.style.width = to.width + 'px';
    if (to.height != null) el.style.height = to.height + 'px';
    if (to.borderRadius != null) el.style.borderRadius = to.borderRadius + 'px';
  });
  return new Promise(r => setTimeout(r, duration));
}

/* 2D -> 3D "pop" — only use this when the user has actually asked for a
   3D/side-on effect, not as a default flourish. Requires `perspective` set
   on the element's PARENT (once, in CSS: perspective: 900px) and
   `transform-style: preserve-3d` where relevant. Apply this to a single
   card/button so the CANVAS stays still and just that content tilts/pops
   forward; apply the same call to `.camera` or `.scene` instead if the
   user wants the whole canvas to tilt while its content stays flat. */
function popOut3D(el, opts = {}) {
  const { rotateY = 10, rotateX = 0, translateZ = 50, duration = 650 } = opts;
  el.style.transition = `transform ${duration}ms cubic-bezier(.2,.8,.2,1)`;
  el.style.transform = `perspective(900px) rotateY(${rotateY}deg) rotateX(${rotateX}deg) translateZ(${translateZ}px)`;
  return new Promise(r => setTimeout(r, duration));
}
function resetPop3D(el, duration = 500) {
  el.style.transition = `transform ${duration}ms cubic-bezier(.2,.8,.2,1)`;
  el.style.transform = 'perspective(900px) rotateY(0deg) rotateX(0deg) translateZ(0px)';
  return new Promise(r => setTimeout(r, duration));
}

/* Cursor press/release — squash the cursor icon slightly, like a real click. */
async function pressCursor(cursorEl) {
  cursorEl.style.transition = 'transform 90ms ease-out';
  cursorEl.style.transform = 'scale(0.85)';
  await new Promise(r => setTimeout(r, 90));
}
async function releaseCursor(cursorEl) {
  cursorEl.style.transform = 'scale(1)';
  await new Promise(r => setTimeout(r, 90));
}

/* Ripple + a reactive "pop" on whatever element was clicked. Call this on
   the TARGET button, not the cursor. Add `.reactive` CSS from the skill doc
   to the button so :active-style feedback matches this JS-driven ripple.
   Defaults to the element's center — pass `at` ({x, y} in px, relative to
   the element's own top-left) for a click that's meant to land somewhere
   more specific, e.g. the start of a text field rather than its middle. */
function clickRipple(targetEl, at) {
  const ripple = document.createElement('span');
  ripple.className = 'ui-ripple';
  ripple.style.left = at ? at.x + 'px' : '50%';
  ripple.style.top = at ? at.y + 'px' : '50%';
  targetEl.appendChild(ripple);
  targetEl.classList.add('is-pressed');
  requestAnimationFrame(() => ripple.classList.add('run'));
  setTimeout(() => targetEl.classList.remove('is-pressed'), 160);
  setTimeout(() => ripple.remove(), 650);
}

/* Types into an element's textContent (or an <input>'s value) at a human,
   slightly irregular pace rather than a perfectly even one. */
async function typeText(el, text, opts = {}) {
  const isInput = 'value' in el;
  const base = opts.speed ?? 38; // ms per character, baseline
  for (let i = 0; i < text.length; i++) {
    const jitter = base * (0.6 + Math.random() * 0.8);
    await new Promise(r => setTimeout(r, jitter));
    if (isInput) el.value += text[i];
    else el.textContent += text[i];
    if (opts.onType) opts.onType();
  }
}

/* Moves/zooms the camera. `to` is {x, y, scale} where x/y are the CSS
   translate in px (usually negative, to push content up/left as you zoom
   into it) and scale is the zoom factor. Always set transform-origin on
   the camera element to '0 0' once, up front. Push-ins (anticipatory)
   should use the fuller duration; use quickZoomOut for the reactive pull
   back that fires WITH a click, not after it. */
function moveCamera(cameraEl, to, duration = 900, easing = Easing.inOutCubic) {
  const style = getComputedStyle(cameraEl).transform;
  const m = new DOMMatrixReadOnly(style === 'none' ? undefined : style);
  const from = { x: m.e, y: m.f, scale: m.a };
  return raf(duration, t => {
    const e = easing(t);
    const x = from.x + (to.x - from.x) * e;
    const y = from.y + (to.y - from.y) * e;
    const s = from.scale + (to.scale - from.scale) * e;
    cameraEl.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  });
}

/* Reads the CURRENT true position of an element's center, in the SAME
   local (pre-transform) coordinate space that the cursor's own left/top
   are set in — by measuring the element on screen and inverting the
   camera's current transform. Use this instead of guessed/hand-picked
   pixel coordinates for every cursor destination: a hardcoded {x,y} will
   drift out of alignment the moment layout, zoom, or content size
   changes, and is the most common reason a "click" ends up not actually
   landing on the thing it's meant to click. Works correctly regardless of
   the camera's current zoom/pan, since it inverts whatever transform is
   active at the moment you call it. */
function sceneCoordsOfElementCenter(el, stage, camera) {
  const rect = el.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const style = getComputedStyle(camera).transform;
  const m = new DOMMatrixReadOnly(style === 'none' ? undefined : style);
  const screenX = rect.left - stageRect.left + rect.width / 2;
  const screenY = rect.top - stageRect.top + rect.height / 2;
  return { x: (screenX - m.e) / m.a, y: (screenY - m.f) / m.a };
}

/* Same idea, but anchored to the START (left edge) of the element rather
   than its middle. Use this — not the center version — for any text field
   about to be typed into: the click and the camera's initial focus should
   land where the typing itself actually begins, not the field's midpoint.
   That also leaves the follow-effect room to travel as the caret moves
   right, instead of starting already centered with nowhere to go. */
function sceneCoordsOfElementStart(el, stage, camera, insetX = 20) {
  const rect = el.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const style = getComputedStyle(camera).transform;
  const m = new DOMMatrixReadOnly(style === 'none' ? undefined : style);
  const screenX = rect.left - stageRect.left + insetX;
  const screenY = rect.top - stageRect.top + rect.height / 2;
  return { x: (screenX - m.e) / m.a, y: (screenY - m.f) / m.a };
}

/* The cursor asset's visual tip isn't at the image's top-left corner (the
   value you set via style.left/top) — it's a few px in. Subtract this from
   any computed destination before calling moveCursor so the pointer's
   actual TIP lands on the target, not the invisible corner of its bounding
   box. Tune to match whatever cursor asset you're using. */
const CURSOR_TIP_OFFSET = { x: 4, y: 2 };

/* Turns a measured scene point + desired zoom into the exact camera
   {x,y,scale} that will place that point at a given fraction of the
   visible stage (e.g. {x:0.5, y:0.55} = just past center) — replacing
   hand-picked translate values with numbers derived from where the
   element actually is. */
function cameraFocusOn(scenePoint, scale, targetFrac, stage) {
  const stageRect = stage.getBoundingClientRect();
  const targetScreenX = stageRect.width * targetFrac.x;
  const targetScreenY = stageRect.height * targetFrac.y;
  return {
    x: targetScreenX - scenePoint.x * scale,
    y: targetScreenY - scenePoint.y * scale,
    scale
  };
}
/* A fast, snappy release — call this at the SAME moment as a click's
   ripple/grow feedback, not as a slower step afterward. Reads as "the app
   just responded," not "the camera eventually drifted back." */
function quickZoomOut(cameraEl, to = { x: 0, y: 0, scale: 1 }, duration = 260) {
  return moveCamera(cameraEl, to, duration, Easing.outCubic);
}

/* Moves the cursor to a spot well outside the visible stage, so it's
   clipped by the stage's overflow:hidden regardless of current zoom.
   Call this right after a click-into-a-field, before typing starts —
   never leave the cursor sitting on top of text that's being written. */
function parkCursorOffscreen(cursorEl, currentPos, stage, duration = 450) {
  const stageRect = stage.getBoundingClientRect();
  const park = { x: currentPos.x, y: stageRect.height + 400 };
  return moveCursor(cursorEl, currentPos, park, duration, { bow: 0 }).then(() => park);
}

/* Continuously follows a moving target (e.g. the caret while typing) with
   exponential damping instead of one-shot moves re-triggered per
   keystroke — that re-triggering is what causes visible jitter, since each
   new transition fights the tail end of the last one. `getTarget()` is
   called every animation frame and should return the CURRENT desired
   {x, y, scale} given the camera's CURRENT transform (read it fresh each
   call) — e.g. via `caretTarget()` below. `tau` is a time-constant in ms:
   smaller = snappier, larger = smoother/slower to catch up. Returns a
   function you call once to stop the loop, right as typing ends. */
function followCameraSmooth(cameraEl, stageEl, getTarget, opts = {}) {
  const tau = opts.tau ?? 260;
  let running = true;
  let last = performance.now();
  function frame(now) {
    if (!running) return;
    const dt = now - last; last = now;
    const target = getTarget();
    const style = getComputedStyle(cameraEl).transform;
    const m = new DOMMatrixReadOnly(style === 'none' ? undefined : style);
    const k = 1 - Math.exp(-dt / tau);
    const x = m.e + (target.x - m.e) * k;
    const y = m.f + (target.y - m.f) * k;
    const s = m.a + (target.scale - m.a) * k;
    cameraEl.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  return () => { running = false; };
}

/* A target-computer for use with followCameraSmooth: reads the CURRENT
   camera transform and the CURRENT text in `el`, and returns the SAME
   position if the caret is still inside the safe zone, or a nudged
   position if it has drifted out — a dead-zone, not a per-character
   destination. Combined with the exponential damping above, the result is
   one continuous, smooth chase rather than a stepped one. */
function caretTarget(el, stage, camera, opts = {}) {
  const safeZone = opts.safeZone || [0.35, 0.78];
  if (!caretTarget._measurer) {
    const m = document.createElement('span');
    Object.assign(m.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'pre', left: '-9999px' });
    document.body.appendChild(m);
    caretTarget._measurer = m;
  }
  const measurer = caretTarget._measurer;
  measurer.style.font = getComputedStyle(el).font;
  const isInput = 'value' in el;
  measurer.textContent = isInput ? el.value : el.textContent;
  const textWidth = measurer.getBoundingClientRect().width;
  const elRect = el.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  const style = getComputedStyle(camera).transform;
  const m2 = new DOMMatrixReadOnly(style === 'none' ? undefined : style);
  const scale = m2.a;
  const caretScreenX = elRect.left + (isInput ? 12 : 0) + textWidth * scale;
  const frac = (caretScreenX - stageRect.left) / stageRect.width;
  if (frac <= safeZone[1] && frac >= safeZone[0]) return { x: m2.e, y: m2.f, scale };
  const targetFrac = frac > safeZone[1] ? safeZone[1] : safeZone[0];
  const dx = (targetFrac - frac) * stageRect.width;
  return { x: m2.e + dx, y: m2.f, scale };
}

/* Runs an array of step functions strictly in sequence. Each step is just
   a function returning a promise (or a plain async function) — this makes
   it easy to interleave cursor moves, camera moves, and typing without
   hand-rolling a new chain every time. Steps that should happen at the
   SAME time should be combined with Promise.all() inside one step. */
async function runTimeline(steps) {
  for (const step of steps) {
    await step();
  }
}
