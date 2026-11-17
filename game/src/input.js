// input.js — keyboard + mouse + dash, in one place.
// The game reads this, never the DOM events directly, so the fixed-step
// loop and the deterministic shot stager can drive the same state.

export function createInput(canvas) {
  const input = {
    keys: new Set(),
    mouseX: 640,
    mouseY: 300,
    mouseDown: false,
    dashQueued: false,
    // One-shot edge flags, consumed by the loop each step.
    pressedKeys: new Set(),
    clicked: false,
    clickedX: 0,
    clickedY: 0,
  };

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (!event.repeat) {
      input.pressedKeys.add(event.code);
      if (event.code === 'Space') input.dashQueued = true;
    }
    input.keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    input.keys.delete(event.code);
  });
  canvas.addEventListener('mousemove', (event) => {
    const point = canvasPoint(event);
    input.mouseX = point.x;
    input.mouseY = point.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    const point = canvasPoint(event);
    input.mouseX = point.x;
    input.mouseY = point.y;
    if (event.button === 2) {
      input.dashQueued = true;
    } else {
      input.mouseDown = true;
      input.clicked = true;
      input.clickedX = point.x;
      input.clickedY = point.y;
    }
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('blur', () => {
    input.keys.clear();
    input.mouseDown = false;
  });

  input.isDown = (code) => input.keys.has(code);
  input.wasPressed = (code) => input.pressedKeys.has(code);

  // Move vector from WASD or arrows, normalised so diagonals are not faster.
  input.moveVector = () => {
    let x = 0;
    let y = 0;
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) x -= 1;
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) x += 1;
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) y -= 1;
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const length = Math.hypot(x, y);
      x /= length;
      y /= length;
    }
    return { x, y };
  };

  // Aim point: the mouse when it has moved, else the nearest mote so a
  // keyboard-only player can still play (Z aims, X dashes — see main.js).
  input.aimPoint = (player, motes) => {
    if (input.keys.has('KeyZ') && motes && motes.length > 0) {
      let best = motes[0];
      let bestDistance = Infinity;
      for (const mote of motes) {
        const d = Math.hypot(mote.x - player.x, mote.y - player.y);
        if (d < bestDistance) { bestDistance = d; best = mote; }
      }
      return { x: best.x, y: best.y };
    }
    return { x: input.mouseX, y: input.mouseY };
  };

  input.consumeDash = () => {
    const queued = input.dashQueued;
    input.dashQueued = false;
    return queued;
  };

  input.consumeClick = () => {
    const click = input.clicked ? { x: input.clickedX, y: input.clickedY } : null;
    input.clicked = false;
    return click;
  };

  // Called at the end of every fixed step so edge flags live one step.
  input.endStep = () => {
    input.pressedKeys.clear();
  };

  return input;
}
