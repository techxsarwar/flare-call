import React, { useEffect, useRef } from "react";

export function AudioVisualizer({ analyser, active = true, color = "#6366f1", height = 80 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !analyser || !active) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let animationFrameId;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    let lastTime = 0;
    const fpsInterval = 1000 / 30; // Cap visualizer at 30 FPS to save laptop CPU/battery

    const render = (currentTime) => {
      animationFrameId = requestAnimationFrame(render);

      // Throttle to 30 FPS
      const elapsed = currentTime - lastTime;
      if (elapsed < fpsInterval) return;
      lastTime = currentTime - (elapsed % fpsInterval);

      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.0;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const val = dataArray[i];
        if (val < 5) {
          x += barWidth;
          continue;
        }

        const barHeight = (val / 255) * (canvas.height * 0.85);

        // Smooth vertical gradient without heavy shadowBlur
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, "#38bdf8");

        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 3, barHeight);

        x += barWidth;
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [analyser, active, color]);

  return (
    <canvas
      ref={canvasRef}
      width={240}
      height={height}
      className="audio-visualizer-canvas"
      style={{ display: active ? "block" : "none" }}
    />
  );
}
