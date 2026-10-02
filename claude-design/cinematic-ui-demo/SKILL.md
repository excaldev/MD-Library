---
name: cinematic-ui-demo
description: Create cinematic product-demo / promo motion graphics in the style of Anthropic's own marketing videos — a simulated mouse cursor performing close-up interactions with reactive buttons, and a camera that is never fixed, instead panning and zooming dynamically in response to events like clicking a button or typing into a prompt box. Use this whenever the user asks for a promo video, product demo, app walkthrough animation, marketing motion graphic, "show someone using the app" video, or explicitly references an "Anthropic-style" video — even if they don't name a file format. Output is a self-contained animated HTML artifact (screen-recordable), since Claude cannot export a literal video file.
---

# Cinematic UI Demo

This skill builds short, looping, autoplaying HTML/CSS/JS artifacts that *look* like a
polished screen-recording of someone using a product — the kind of video used in app
launches and AI-product marketing. The user records their own screen while it plays.

## The visual language (what makes it feel "cinematic" and not like a static screenshot)

1. **A cursor that moves with intent, not decoration.** The cursor's path is aimed
   directly at wherever it's headed next — a small, consistent arc for organic feel is
   fine, but the arc should never be so large or randomized that the movement reads as
   wandering. Every cursor move exists because the cursor is *going somewhere to do
   something*; there's no idle drifting. **Every destination must be measured, never
   guessed.** Compute cursor targets from the actual element's current position
   (`sceneCoordsOfElementCenter`) rather than hand-picked pixel coordinates — a guessed
   `{x, y}` is the most common reason a "click" visibly lands somewhere other than the
   button it's supposed to hit, especially once layout, zoom, or content size changes.
   **For a text field about to be typed into, target its START, not its center**
   (`sceneCoordsOfElementStart`) — that's where the click and the camera's initial
   focus actually belong, since that's literally where the typing action begins, and
   it leaves the caret-follow effect room to travel across the field afterward rather
   than starting already centered with nowhere to go. Also account for the cursor
   asset's own tip offset (`CURSOR_TIP_OFFSET`): the value you set via
   `style.left/top` is the image's corner, not its visual point, so subtract the
   offset before handing a destination to `moveCursor`. Once it has done its job
   (clicked into a field that's about to be typed into), animate it out of view
   first — park it off the visible frame before typing starts, rather than leaving it
   sitting on top of the text. Bring it back in only when it has somewhere new to go
   (the next target), arriving from that same parked position — the disappearance and
   reappearance both read as intentional, not like it just vanished.
2. **Reactive elements, not static ones.** Since the cursor is a simulated image (not a
   real pointer), CSS `:hover` never fires on its own — trigger the equivalent
   explicitly the instant the cursor's move finishes arriving at a target (see
   `cursorArrive`/`cursorLeave` below), then layer a click ripple + a brief grow-pulse
   on the actual click. Nothing should look inert.

   Keep two separate states distinct, because conflating them is the most common way
   this breaks: **hover** (`is-hovered`) is momentary and tracks where the cursor
   physically is right now — it comes and goes with `cursorArrive`/`cursorLeave`.
   **Focus** (`is-focused`) is tied to an ongoing action, not to the cursor's
   position, and must persist for the entire action even if the cursor itself has
   moved away or off-frame — e.g. a text field's glow stays on for as long as text is
   being typed into it, and only clears once typing is actually finished, regardless
   of where the cursor went in the meantime (including being parked off-screen, see
   below). Clearing a focus state early because the cursor happened to leave is a bug,
   not a stylistic choice.
3. **A camera that moves with the story, not a fixed frame** — and reacts *to the
   event*, not on a timer:
   - Pushing in (e.g. onto a text field about to be typed into, or a button about to
     be clicked) can be slower and more cinematic — that's an anticipatory move. This
     push-in-and-hold treatment isn't limited to text fields — apply it to buttons and
     any other element the story is about to focus on.
   - Whenever the camera is going to hold a frame for more than a beat (a button being
     considered, a field mid-type), don't let the hold read as a frozen still frame —
     layer in `idleBreathe`, a very small continuous scale oscillation, so there's
     always *some* motion on screen even during a pause.
   - Zoom in as far as the moment calls for — don't play it safe with a shallow zoom
     just to be cautious. The whole point of the camera-follow effect while typing is
     that it's *visible*; a deep push-in makes the tracking read clearly, a shallow
     one hides it.
   - Pulling back out is the *consequence* of something the user just did — a click, a
     submit — and should happen quickly, right at the moment of that click, not ease
     out slowly afterward. A fast release reads as "the app just responded"; a slow
     one reads as sluggish.
   - While text is being typed, the camera should track the caret so the growing text
     stays in frame — but as one continuous, smoothly-damped follow, never as a series
     of separate little corrections re-triggered on every new character. Re-starting
     a move on every keystroke is what causes visible jitter; a single ongoing
     follow loop that eases toward wherever the caret currently is does not. See
     "Camera following typed text" below.
   - Never move the camera without a reason, and never leave it static for more than a
     couple of seconds.
4. **Everything eases — nothing snaps or moves linearly**, except the deliberately fast
   release described above, which should still ease (just over a much shorter
   duration) rather than cut instantly.
5. **Elements can genuinely reshape, not just scale.** A button growing into a status
   pill, a card expanding into a panel, an input widening to make room for more text —
   these are real width/height/border-radius transitions (`morphSize`), not a
   transform trick. Reach for this whenever part of the story is one piece of UI
   becoming a different part of the interface, rather than just a react-in-place.
   Reshaping one element pushes on its layout neighbors, so bring them along
   deliberately (matching transitions, `align-items: center`) rather than letting
   them snap — see "Reshaping elements" below.
6. **2D → 3D pop, only when the user actually asks for it.** For a request to see a
   card "from the side," or content that pops off the canvas, use `popOut3D` /
   `resetPop3D` (perspective + rotateY/rotateX + translateZ). This is deliberately not
   part of the default visual language above — use it on request, and pick which
   layer receives the tilt based on what was asked for: apply it to the individual
   card/button so the canvas stays flat and just that content tilts forward, or apply
   the same transform to `.camera`/`.scene` instead so the whole canvas tilts while
   its contents stay flat relative to each other.

Keep the actual on-screen product mockup itself clean and simple — generous padding,
soft shadows, rounded corners, confident type. The interest comes from the *motion*,
not from a busy interface. **"Subtle" means restrained, not colorless** — when the
user hasn't specified a scheme, prefer a small, coherent palette (e.g. one dark or
neutral base plus a single accent hue, with clear light/dark text contrast) over a
loud multi-color mockup; it's about discipline in how many colors are doing work at
once, not about avoiding color itself. When the user gives an explicit palette or
theme, use exactly that. **Specific case: if the user asks for an "Apple-style" UI,
use a yellow/orange/red palette** — this is a deliberate exception to Apple's usual
cool blue/gray system look, not an oversight, so don't default back to blue/gray for
this specific request.

**Do not recreate another company's actual branded product UI** (their exact logo,
wordmark, or pixel-accurate layout) unless the user has explicitly provided it as their
own product to demo. Build a clean, generic, plausible-looking mockup UI inspired by
this cinematography style — the technique is what's being reused here, not anyone's
trademarked interface. If the user wants to demo their own real product, ask them to
describe or share what it looks like.

## Architecture

Three layered pieces, nested in this order:

```
.stage                 (fixed-size viewport, overflow: hidden, this is "the screen")
  .camera               (the thing that pans/zooms — transform-origin: 0 0)
    .scene              (the mockup UI: absolutely/flex positioned elements)
    #cursor              (the cursor image — lives INSIDE .camera, so it scales
                          with zoom exactly like a real screen-recording zoom would)
```

Putting the cursor inside `.camera` rather than layering it on top of everything is
the detail that sells the illusion — when the camera pushes in, the cursor should
appear to get bigger along with the UI, exactly like a real recording with a zoom
effect applied in post.

## Building the animation

1. Read `assets/timeline-engine.js` and inline its full contents into a `<script>` tag
   near the end of the `<body>` — it's dependency-free vanilla JS (cursor arc
   movement, click ripple, typing effect, camera moves, a sequential step runner).
2. Read `assets/cursor.svg` and inline it (or reference it as a data URI) as the
   cursor element's image source.
3. Storyboard the sequence as a plain list of steps *before* writing code — e.g.:
   - cursor arcs down to the prompt input
   - camera pushes in on the input
   - input gets a focus ring; cursor "clicks" it
   - text types in, character by character
   - cursor arcs over to the send button; button gets a hover glow on arrival
   - cursor presses down; ripple fires; camera nudges to frame the response area
   - response content fades/types in; camera eases back out to the full view
   - short hold, then loop (fade to start, or reset instantly and fade in)
4. Translate the storyboard directly into an array of async step functions and run it
   with `runTimeline([...])`. Each step is one motivated beat — resist cramming two
   unrelated things into one step.
5. Loop the whole sequence (wrap `runTimeline` in a `while(true)` inside an async
   IIFE, or call it again `.then()`) since this is meant to play on repeat while
   someone screen-records it, not run once and stop.

### Reactive CSS (pair with the JS ripple/press/grow classes)

Because the cursor is only a simulated image, real `:hover` won't trigger from it —
`is-hovered` below must be toggled explicitly by `cursorArrive`/`cursorLeave` at the
moment the cursor's move animation finishes, not left to the browser.

```css
.reactive {
  transition: box-shadow 200ms ease, transform 140ms ease, background 200ms ease;
}
.reactive.is-hovered,
.reactive.is-focused { box-shadow: 0 0 0 4px rgba(0,0,0,0.08); }
.reactive.is-pressed { transform: scale(0.96); }

.ui-ripple {
  position: absolute; width: 8px; height: 8px; margin: -4px;
  border-radius: 50%; background: rgba(255,255,255,0.5);
  transform: scale(0); pointer-events: none;
}
.ui-ripple.run {
  transition: transform 550ms ease-out, opacity 550ms ease-out;
  transform: scale(18); opacity: 0;
}
```

`is-hovered` toggles with the cursor's arrival/departure; `is-focused` is set once
(e.g. on the click that starts an interaction) and cleared once explicitly, at the end
of the whole action — never tied to the cursor's position. The two can safely share
one visual style, as above, since they're rarely true-and-false at conflicting times,
but they must be tracked as separate flags.

Use `growPulse(el)` (a brief scale-up-then-settle, not a CSS class) for the moment an
element should visibly react to interaction beyond the ripple — e.g. right as the
cursor arrives, or right after a successful click — so buttons and text fields feel
tactile rather than flat.

### Camera moves (`moveCamera`)

Coordinates are the translate distance in px plus a scale factor. Prefer deriving
these from a measured point (`cameraFocusOn(sceneCoordsOfElementCenter(el, stage,
camera), scale, targetFrac, stage)`) over hand-picking them — the same reasoning as
cursor destinations above: a guessed translate looks right only until the layout
shifts, while a derived one stays correct.

```js
const point = sceneCoordsOfElementCenter(send, stage, camera);
await moveCamera(camera, cameraFocusOn(point, 1.9, {x:0.5, y:0.55}, stage), 850);  // push in — slower, anticipatory
await quickZoomOut(camera, {x:0,y:0,scale:1}, 260);                                // pull back on click — fast, reactive
```

### Camera following typed text

While a line is being typed, don't leave the frame fixed and don't let the growing
text run off-frame — but also don't re-trigger a fresh camera move on every single
character, which is what produces visible jitter (each new transition fights the tail
end of the last one). Instead run **one continuous follow loop** for the whole typing
action: every animation frame, recompute where the caret currently is, and ease the
camera a little closer to keeping it in a comfortable "safe zone" — the same way a
handheld camera makes small continuous corrections rather than a series of discrete
jumps. `followCameraSmooth` in `assets/timeline-engine.js` does this with exponential
damping (a `tau` time-constant, not a duration) so it naturally settles rather than
overshoots; start it right as typing begins and stop it right as typing ends. Use this
in place of the plain per-character approach whenever the camera is zoomed in on the
field being typed into.

### Cursor exits before typing, returns with the next move

Once the cursor has clicked into the field that's about to receive text, animate it
out of the visible frame (`parkCursorOffscreen`) *before* the typing starts — don't
leave it sitting on top of the text being written. When it's time for the next action
(e.g. moving to a send button), the cursor's very next move should start from that
same parked position, so it reads as "the cursor went and did something else, then
came back" rather than an unexplained disappearance and reappearance. Note that
parking the cursor is not the same event as clearing the field's `is-focused` glow —
the glow stays on through the whole typing action regardless of where the cursor went.

### Reshaping elements (`morphSize`) and the 2D → 3D pop (`popOut3D`)

`morphSize` transitions real width/height/border-radius rather than a transform, so an
element can become a visibly different shape — a compact send button widening into a
"Sending…" pill, then narrowing back once a response starts arriving, is a good
default use of this. Give it explicit target values in px; it reads the element's
current size automatically if no starting size is set inline.

**Reshaping one element moves its neighbors too — plan for that, don't let it just
happen.** A button that grows inside a flex row pushes on whatever sits next to it
(e.g. a `flex:1` input shrinking to make room), and that neighbor will otherwise snap
into its new size instantly instead of moving in sync with the thing that triggered
it — which reads as broken alignment, not as one considered motion. Two things fix
this:
- Put `align-items: center` on the row so children of different (or changing)
  heights stay vertically centered against each other, rather than stretching to
  match whichever one is currently tallest.
- Give the neighbor its own transition on `flex-basis`/`width` (matching the
  `morphSize` duration), not just the element that's actually being told to morph —
  otherwise only one side of the row eases and the other jumps.

```css
.prompt { transition: box-shadow 200ms ease, border-color 200ms ease,
                       flex-basis 380ms cubic-bezier(.4,0,.2,1), width 380ms cubic-bezier(.4,0,.2,1); }
.prompt-row { display: flex; align-items: center; gap: 14px; }
```

Also, because `morphSize` changes real layout, any point measured *before* the morph
(a cursor target, a camera focus point) is now stale — always re-measure with
`sceneCoordsOfElementCenter`/`sceneCoordsOfElementStart` after a reshape rather than
reusing a coordinate captured earlier in the timeline.

`popOut3D` / `resetPop3D` need `perspective` set in CSS on whichever element is the
parent of the thing being tilted (e.g. `.stage { perspective: 900px; }`), plus
`transform-style: preserve-3d` on elements that should keep their children flat while
tilting. This effect is opt-in — only reach for it when the user has asked for a
3D/side-on/pop-out look for a card or button, not as a default flourish alongside the
rest of the visual language above.

### A minimal working skeleton

```html
<div class="stage">
  <div class="camera" id="camera">
    <div class="scene">
      <div class="mock-window">
        <input class="prompt reactive" id="prompt" readonly>
        <button class="send reactive" id="send">Send</button>
        <div class="response" id="response"></div>
      </div>
      <img src="cursor.svg" class="cursor" id="cursor" style="left:400px; top:300px;">
    </div>
  </div>
</div>
<script>
  const camera = document.getElementById('camera');
  const cursor = document.getElementById('cursor');
  const prompt = document.getElementById('prompt');
  const send = document.getElementById('send');
  const response = document.getElementById('response');

  async function play() {
    const promptPt = sceneCoordsOfElementCenter(prompt, stage, camera);
    const sendPt = sceneCoordsOfElementCenter(send, stage, camera);
    const cursorAt = { x: promptPt.x - CURSOR_TIP_OFFSET.x, y: promptPt.y - CURSOR_TIP_OFFSET.y };

    await moveCursor(cursor, {x:400,y:300}, cursorAt, 700);
    await moveCamera(camera, cameraFocusOn(promptPt, 1.9, {x:0.45,y:0.55}, stage), 800); // anticipatory push-in
    cursorArrive(prompt);
    await pressCursor(cursor); clickRipple(prompt); await growPulse(prompt); await releaseCursor(cursor);
    prompt.classList.add('is-focused');                              // persists through typing, not tied to the cursor
    cursorLeave(prompt);
    const parked = await parkCursorOffscreen(cursor, cursorAt, stage, 500); // exits view before typing
    const stopFollow = followCameraSmooth(camera, stage, () => caretTarget(prompt, stage, camera));
    await typeText(prompt, "Plan a 3-day trip to Kyoto", {speed:35});
    stopFollow();
    prompt.classList.remove('is-focused');                           // only cleared once typing is actually done
    const sendCursorAt = { x: sendPt.x - CURSOR_TIP_OFFSET.x, y: sendPt.y - CURSOR_TIP_OFFSET.y };
    await moveCursor(cursor, parked, sendCursorAt, 500);              // returns for the next action
    cursorArrive(send);
    await moveCamera(camera, cameraFocusOn(sendPt, 1.9, {x:0.5,y:0.5}, stage), 700);
    const stopBreathe = idleBreathe(send);                           // hold isn't a frozen frame
    await new Promise(r => setTimeout(r, 500));
    stopBreathe();
    await pressCursor(cursor); clickRipple(send); await releaseCursor(cursor);
    quickZoomOut(camera, {x:0,y:0,scale:1}, 260);                    // fast, fires WITH the click, not after
    await typeText(response, "Here's a 3-day Kyoto itinerary...", {speed:18});
    await new Promise(r => setTimeout(r, 1800));
  }
  (async () => { while (true) { await play(); response.textContent = ''; prompt.value=''; } })();
</script>
```

This is a skeleton, not a template to fill in blindly — design the actual mockup UI,
copy, colors, and specific beats to match what the user is promoting.

## Delivering the result

This is a self-contained HTML file, so publish it as an artifact when that tool is
available (so the person can open, replay, and screen-record it directly) rather than
only handing back a file. Everything — CSS, the inlined engine script, and the cursor
SVG — must live in the one file; there is no server and no external assets folder once
it's shipped. Mention plainly that Claude can't output an actual .mp4/.mov — the person
records their own screen while the artifact plays, which is exactly the workflow they're
already expecting.
