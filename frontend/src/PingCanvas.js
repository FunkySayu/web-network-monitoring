import React, { useEffect, useRef } from 'react';

const PingCanvas = ({ lastEvent }) => {
  const canvasRef = useRef(null);
  const workerRef = useRef(null);
  const containerRef = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!canvasRef.current || initialized.current) return;

    const canvas = canvasRef.current;
    if (!canvas.transferControlToOffscreen) {
        console.warn("OffscreenCanvas not supported");
        return;
    }

    let offscreen;
    try {
        offscreen = canvas.transferControlToOffscreen();
        initialized.current = true;
    } catch (e) {
        console.error("Failed to transfer control to offscreen", e);
        return;
    }

    let worker;
    try {
      worker = new Worker(new URL('./pingWorker.js', import.meta.url));
    } catch (e) {
      console.error("Failed to initialize worker", e);
      return;
    }
    workerRef.current = worker;

    worker.postMessage({
      type: 'init',
      canvas: offscreen
    }, [offscreen]);

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        const { width, height } = entries[0].contentRect;
        worker.postMessage({
          type: 'resize',
          data: { width, height }
        });
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      worker.terminate();
    };
  }, []);

  useEffect(() => {
    if (workerRef.current && lastEvent) {
      workerRef.current.postMessage({
        type: 'event',
        data: lastEvent
      });
    }
  }, [lastEvent]);

  return (
    <div ref={containerRef} style={{ width: '100%', height: 'calc(100vh - 100px)', overflow: 'hidden', background: '#282c34' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
    </div>
  );
};

export default PingCanvas;
