"use client";

import { useEffect, useRef } from "react";

const GLOBE_RGB = "21,128,61";

export function SpinningGlobe() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const canvasElement: HTMLCanvasElement = canvas;

    const renderingContext = canvasElement.getContext("2d");

    if (!renderingContext) {
      return;
    }

    const context: CanvasRenderingContext2D = renderingContext;

    let width = 0;
    let height = 0;
    let centerX = 0;
    let centerY = 0;
    let rotation = 0;
    let frameId = 0;

    function resize() {
      width = canvasElement.width = canvasElement.offsetWidth;
      height = canvasElement.height = canvasElement.offsetHeight;
      centerX = width / 2;
      centerY = height / 2;
    }

    function draw() {
      context.clearRect(0, 0, width, height);

      const radius = Math.min(width, height) * 0.38;
      const perspective = 0.28;

      const outerGlow = context.createRadialGradient(
        centerX,
        centerY,
        radius * 0.4,
        centerX,
        centerY,
        radius * 2.2,
      );
      outerGlow.addColorStop(0, `rgba(${GLOBE_RGB},0.07)`);
      outerGlow.addColorStop(1, `rgba(${GLOBE_RGB},0)`);
      context.beginPath();
      context.arc(centerX, centerY, radius * 2.2, 0, Math.PI * 2);
      context.fillStyle = outerGlow;
      context.fill();

      const sphereFill = context.createRadialGradient(
        centerX - radius * 0.3,
        centerY - radius * 0.3,
        0,
        centerX,
        centerY,
        radius,
      );
      sphereFill.addColorStop(0, `rgba(${GLOBE_RGB},0.06)`);
      sphereFill.addColorStop(1, `rgba(${GLOBE_RGB},0.01)`);
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.fillStyle = sphereFill;
      context.fill();

      context.save();
      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.clip();

      for (let index = 0; index < 18; index += 1) {
        const longitude = (index / 18) * Math.PI + rotation;
        const sinLongitude = Math.sin(longitude);
        const cosLongitude = Math.cos(longitude);
        const ellipseRadius = Math.abs(sinLongitude) * radius;

        if (ellipseRadius < 1) {
          continue;
        }

        const isFront = cosLongitude >= 0;
        const alpha = isFront
          ? (0.08 + Math.abs(sinLongitude) * 0.48).toFixed(2)
          : (0.02 + Math.abs(sinLongitude) * 0.07).toFixed(2);

        context.beginPath();
        context.ellipse(centerX, centerY, ellipseRadius, radius, 0, 0, Math.PI * 2);
        context.strokeStyle = `rgba(${GLOBE_RGB},${alpha})`;
        context.lineWidth = isFront ? 0.8 : 0.35;
        context.stroke();
      }

      for (let index = 1; index <= 8; index += 1) {
        const latitude = (index / 9) * Math.PI - Math.PI / 2;
        const y = centerY + Math.sin(latitude) * radius;
        const latitudeRadius = Math.cos(latitude) * radius;

        if (latitudeRadius < 1) {
          continue;
        }

        context.beginPath();
        context.ellipse(centerX, y, latitudeRadius, latitudeRadius * perspective, 0, 0, Math.PI * 2);
        context.strokeStyle = `rgba(${GLOBE_RGB},0.16)`;
        context.lineWidth = 0.6;
        context.stroke();
      }

      context.beginPath();
      context.ellipse(centerX, centerY, radius, radius * perspective, 0, 0, Math.PI * 2);
      context.strokeStyle = `rgba(${GLOBE_RGB},0.38)`;
      context.lineWidth = 1.2;
      context.stroke();

      context.restore();

      context.beginPath();
      context.arc(centerX, centerY, radius, 0, Math.PI * 2);
      context.strokeStyle = `rgba(${GLOBE_RGB},0.55)`;
      context.lineWidth = 1.5;
      context.stroke();

      context.beginPath();
      context.arc(centerX, centerY, radius + 5, 0, Math.PI * 2);
      context.strokeStyle = `rgba(${GLOBE_RGB},0.10)`;
      context.lineWidth = 12;
      context.stroke();
    }

    function animate() {
      rotation += 0.0035;
      draw();
      frameId = window.requestAnimationFrame(animate);
    }

    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(canvasElement);
    frameId = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full opacity-75" />;
}
