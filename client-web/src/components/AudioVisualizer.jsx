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

    const render = () => {
      animationFrameId = requestAnimationFrame(render);
      analyser.getByteFrequencyData(dataArray);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / bufferLength) * 2.2;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * (canvas.height * 0.9);

        // Smooth glowing gradient
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, "#38bdf8"); // bright cyan top

        ctx.fillStyle = gradient;
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;

        // Rounded pill bars
        ctx.beginPath();
        ctx.roundRect(x, canvas.height - barHeight, barWidth - 3, barHeight, [4, 4, 0, 0]);
        ctx.fill();

        x += barWidth;
      }
    };

    render();

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
