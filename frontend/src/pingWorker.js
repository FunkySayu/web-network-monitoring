/* eslint-disable no-restricted-globals */

let canvas = null;
let ctx = null;
let width = 0;
let height = 0;

const lowerBound = 200; // ms
const higherBound = 2000; // ms
const k = 1;
const r = (1000 / 60) * k;

let startT = null;
let lastP = 0;
let events = []; // { type, time }
const timeOffset = Date.now() - performance.now();

function getPingValue(t) {
  let latestEvent = null;
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].time <= t) {
      latestEvent = events[i];
      break;
    }
  }

  if (latestEvent && (latestEvent.type === 'START')) {
    return Math.max(0, t - latestEvent.time);
  }
  return 0;
}

function getColor(pingValue) {
  if (pingValue < lowerBound) return '#4caf50'; // Green
  if (pingValue < (lowerBound + higherBound) / 2) return '#ff9800'; // Orange
  return '#f44336'; // Red
}

function tick() {
  if (!ctx || width === 0 || height === 0) return;

  const t1 = performance.now();
  if (startT === null) {
    startT = t1;
    return;
  }

  const currentP = (t1 - startT) / r;
  const pixelsToShift = Math.floor(currentP) - Math.floor(lastP);

  if (pixelsToShift >= 1) {
    // Shift canvas left
    if (width > pixelsToShift) {
      ctx.drawImage(canvas, pixelsToShift, 0, width - pixelsToShift, height, 0, 0, width - pixelsToShift, height);
    }
    // Clear the new area
    ctx.fillStyle = '#282c34';
    ctx.fillRect(Math.max(0, width - pixelsToShift), 0, pixelsToShift, height);

    // Draw the new pixels
    for (let i = 0; i < pixelsToShift; i++) {
      const x = width - pixelsToShift + i;
      if (x < 0) continue;

      // t is the time corresponding to this pixel.
      // The rightmost pixel (x = width - 1) corresponds to current absolute time (roughly).
      // Since we shifted, the pixel at width - pixelsToShift + i is at time:
      // t1 - (pixelsToShift - 1 - i) * r
      const t = (t1 - (pixelsToShift - 1 - i) * r) + timeOffset;
      const val = getPingValue(t);
      const barHeight = Math.min(height, (val / higherBound) * height);

      if (barHeight > 0) {
        ctx.fillStyle = getColor(val);
        ctx.fillRect(x, height - barHeight, 1, barHeight);
      }
    }
    lastP = currentP;
  }
}

self.onmessage = (e) => {
  const { type, data } = e.data;
  if (type === 'init') {
    canvas = e.data.canvas;
    ctx = canvas.getContext('2d', { alpha: false });
    width = canvas.width;
    height = canvas.height;

    ctx.fillStyle = '#282c34';
    ctx.fillRect(0, 0, width, height);

    setInterval(tick, 17);
  } else if (type === 'resize') {
    const newWidth = data.width;
    const newHeight = data.height;
    if (newWidth === width && newHeight === height) return;

    // Use a temporary canvas to save current state
    const tempCanvas = new OffscreenCanvas(width, height);
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    canvas.width = newWidth;
    canvas.height = newHeight;

    ctx = canvas.getContext('2d', { alpha: false });
    ctx.fillStyle = '#282c34';
    ctx.fillRect(0, 0, newWidth, newHeight);

    // Draw back existing content, aligned to bottom-right
    const dx = Math.max(0, newWidth - width);
    const dy = Math.max(0, newHeight - height);
    const sx = Math.max(0, width - newWidth);
    const sy = Math.max(0, height - newHeight);
    const sw = Math.min(width, newWidth);
    const sh = Math.min(height, newHeight);

    ctx.drawImage(tempCanvas, sx, sy, sw, sh, dx, dy, sw, sh);

    width = newWidth;
    height = newHeight;
  } else if (type === 'event') {
    const eventTime = new Date(data.timestamp).getTime();
    events.push({ type: data.event, time: eventTime });
    // Keep a reasonable number of events
    if (events.length > 1000) {
      events.shift();
    }
  }
};
