import React, { useState, useRef, useEffect } from 'react';
import { SoapBubbleSurface } from '../soap-bubble';
import { computeGlassBoxShadow, ShadowTone } from '../../types';

interface DualLiquidFusionStageProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  config: any;
  shadowTone: ShadowTone;
  isShadowInverted: boolean;
  darkTintRgba: string;
  borderColorRgba: string;
}

/**
 * Pure Liquid Glass Twin Fusion (Capillary Coalescence):
 * Two authentic liquid glass capsules that users can physically drag with touch/mouse.
 * As they meet, they don't awkwardly slide on top of each other — their inner edges
 * organically merge and coalesce into ONE seamless, united liquid glass body.
 * When pulled apart, the fluid bridge stretches, thins into an elastic catenoid neck, and snaps cleanly!
 */
export const DualLiquidFusionStage: React.FC<DualLiquidFusionStageProps> = ({
  canvasRef,
  config,
  shadowTone,
  isShadowInverted,
  darkTintRgba,
  borderColorRgba,
}) => {
  // Balanced, perfectly centered resting positions
  const [offsetA, setOffsetA] = useState(-115);
  const [offsetB, setOffsetB] = useState(115);
  const [isDraggingA, setIsDraggingA] = useState(false);
  const [isDraggingB, setIsDraggingB] = useState(false);
  const [isHoveredA, setIsHoveredA] = useState(false);
  const [isHoveredB, setIsHoveredB] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ clientX: number; initOffset: number }>({ clientX: 0, initOffset: 0 });

  const boxW = 150;
  const boxH = 68;
  const outerRad = Math.round(boxH / 2); // 34px pill radius

  // Physics collision boundary: centers cannot get closer than boxW (no overlapping!)
  // Contact occurs when centerDist == boxW (edgeGap == 0)
  const centerDist = Math.abs(offsetB - offsetA);
  const edgeGap = Math.max(0, centerDist - boxW);

  // Proximity threshold for capillary meniscus bridge (starts at 50px gap)
  const threshold = 50;
  const isFused = edgeGap < threshold;
  const fusionRatio = Math.max(0, Math.min(1, (threshold - edgeGap) / threshold));

  // Dynamic inner corner radius: turns from full pill (34px) down to 0px as gap approaches 0
  const innerRad = Math.round(outerRad * (1 - Math.pow(fusionRatio, 1.4)));

  // Pointer drag for Box A (Left) - constrained so it cannot push past Box B
  const handlePointerDownA = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingA(true);
    dragStartRef.current = { clientX: e.clientX, initOffset: offsetA };
  };

  const handlePointerMoveA = (e: React.PointerEvent) => {
    if (!isDraggingA) return;
    const dx = e.clientX - dragStartRef.current.clientX;
    // Hard physics stop: center of A cannot exceed offsetB - boxW (zero overlap!)
    const maxA = offsetB - boxW;
    const newOffset = Math.min(maxA, dragStartRef.current.initOffset + dx);
    setOffsetA(Math.max(-240, newOffset));
  };

  const handlePointerUpA = (e: React.PointerEvent) => {
    if (isDraggingA) {
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch (_) {}
      setIsDraggingA(false);
    }
  };

  // Pointer drag for Box B (Right) - constrained so it cannot push past Box A
  const handlePointerDownB = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDraggingB(true);
    dragStartRef.current = { clientX: e.clientX, initOffset: offsetB };
  };

  const handlePointerMoveB = (e: React.PointerEvent) => {
    if (!isDraggingB) return;
    const dx = e.clientX - dragStartRef.current.clientX;
    // Hard physics stop: center of B cannot be less than offsetA + boxW (zero overlap!)
    const minB = offsetA + boxW;
    const newOffset = Math.max(minB, dragStartRef.current.initOffset + dx);
    setOffsetB(Math.min(240, newOffset));
  };

  const handlePointerUpB = (e: React.PointerEvent) => {
    if (isDraggingB) {
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch (_) {}
      setIsDraggingB(false);
    }
  };

  // Gentle hover capillary tension when close
  const effectiveOffsetA = isHoveredA && !isDraggingA && edgeGap > 2 && edgeGap < 60
    ? offsetA + 4
    : offsetA;
  const effectiveOffsetB = isHoveredB && !isDraggingB && edgeGap > 2 && edgeGap < 60
    ? offsetB - 4
    : offsetB;

  // Bridge Catenoid Meniscus geometry
  const midX = (effectiveOffsetA + effectiveOffsetB) / 2;
  const leftContactEdge = effectiveOffsetA + boxW / 2;
  const rightContactEdge = effectiveOffsetB - boxW / 2;
  const neckDip = Math.max(0, outerRad * Math.pow(1 - fusionRatio, 1.3) * 0.88);

  const transitionStyle = isDraggingA || isDraggingB
    ? 'none'
    : 'transform 340ms cubic-bezier(0.16, 1, 0.3, 1), border-radius 240ms ease';

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-[150px] flex flex-col items-center justify-center select-none overflow-visible pointer-events-auto my-auto"
    >
      {/* High-Viscosity Organic Catenoid Liquid Meniscus Bridge */}
      {isFused && (
        <svg
          className="absolute pointer-events-none overflow-visible z-15"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '640px',
            height: `${boxH + 20}px`,
          }}
        >
          <defs>
            <linearGradient id="coalesceGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(34, 211, 238, 0.60)" />
              <stop offset="50%" stopColor="rgba(56, 189, 248, 0.80)" />
              <stop offset="100%" stopColor="rgba(34, 211, 238, 0.60)" />
            </linearGradient>
          </defs>
          <path
            d={`
              M ${320 + leftContactEdge - 8} ${10}
              C ${320 + midX - 8} ${10 + neckDip}, ${320 + midX + 8} ${10 + neckDip}, ${320 + rightContactEdge + 8} ${10}
              L ${320 + rightContactEdge + 8} ${10 + boxH}
              C ${320 + midX + 8} ${10 + boxH - neckDip}, ${320 + midX - 8} ${10 + boxH - neckDip}, ${320 + leftContactEdge - 8} ${10 + boxH}
              Z
            `}
            fill={darkTintRgba || "rgba(8, 10, 16, 0.85)"}
            stroke="url(#coalesceGlow)"
            strokeWidth={1.4}
            opacity={Math.min(1.0, fusionRatio * 1.2)}
            style={{
              transition: isDraggingA || isDraggingB ? 'none' : 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)',
              filter: 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.35))',
            }}
          />
        </svg>
      )}

      {/* Perfectly Centered Observation Arena */}
      <div className="relative w-full h-[88px] flex items-center justify-center">

        {/* LIQUID GLASS BOX A (Left) */}
        <div
          onPointerDown={handlePointerDownA}
          onPointerMove={handlePointerMoveA}
          onPointerUp={handlePointerUpA}
          onPointerCancel={handlePointerUpA}
          onMouseEnter={() => setIsHoveredA(true)}
          onMouseLeave={() => setIsHoveredA(false)}
          className="absolute z-20 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
          style={{
            width: `${boxW}px`,
            height: `${boxH}px`,
            borderRadius: `${outerRad}px ${innerRad}px ${innerRad}px ${outerRad}px`,
            backgroundColor: darkTintRgba,
            boxShadow: computeGlassBoxShadow(config.shadowStep, shadowTone, config.borderOpacity, config.thicknessStep, isShadowInverted),
            transform: `translate3d(${effectiveOffsetA}px, 0, 0)`,
            transition: transitionStyle,
            willChange: 'transform, border-radius',
          }}
        >
          {/* Authentic WebGL Snell Refraction Layer */}
          <SoapBubbleSurface
            backdrop={canvasRef}
            interactive={false}
            wobble={0}
            tilt={0}
            radius={outerRad}
            topRadius={outerRad}
            bottomRadius={outerRad}
            glass={config.glass}
            refraction={config.thicknessStep >= 9 ? config.refraction * 2.85 : config.refraction * (0.70 + (config.thicknessStep / 10) * 0.75)}
            bevel={Math.round(config.thicknessStep >= 9 ? config.bevel * 2.3 : config.bevel * (0.75 + (config.thicknessStep / 10) * 0.55))}
            dispersion={config.dispersion}
            blur={0}
            clearCenter={config.clearCenter}
            paused={false}
            speed={0}
            oilCoverage={0}
            oilOpacity={0}
            iridescence={0}
            glintIntensity={0}
            reflectivity={0.0}
            thickness={config.thickness}
            tint={darkTintRgba}
            className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden"
            style={{
              borderRadius: `${outerRad}px ${innerRad}px ${innerRad}px ${outerRad}px`,
              border: `1px solid ${borderColorRgba}`,
              backdropFilter: config.blur > 0 ? `blur(${config.blur}px)` : undefined,
              WebkitBackdropFilter: config.blur > 0 ? `blur(${config.blur}px)` : undefined,
              transition: 'border-radius 240ms ease',
            }}
          />
          <div className="relative z-10 flex items-center justify-center gap-2 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
            <span className="font-mono text-xs font-bold text-white tracking-widest uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              Glass A
            </span>
          </div>
        </div>

        {/* LIQUID GLASS BOX B (Right) */}
        <div
          onPointerDown={handlePointerDownB}
          onPointerMove={handlePointerMoveB}
          onPointerUp={handlePointerUpB}
          onPointerCancel={handlePointerUpB}
          onMouseEnter={() => setIsHoveredB(true)}
          onMouseLeave={() => setIsHoveredB(false)}
          className="absolute z-20 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
          style={{
            width: `${boxW}px`,
            height: `${boxH}px`,
            borderRadius: `${innerRad}px ${outerRad}px ${outerRad}px ${innerRad}px`,
            backgroundColor: darkTintRgba,
            boxShadow: computeGlassBoxShadow(config.shadowStep, shadowTone, config.borderOpacity, config.thicknessStep, isShadowInverted),
            transform: `translate3d(${effectiveOffsetB}px, 0, 0)`,
            transition: transitionStyle,
            willChange: 'transform, border-radius',
          }}
        >
          {/* Authentic WebGL Snell Refraction Layer */}
          <SoapBubbleSurface
            backdrop={canvasRef}
            interactive={false}
            wobble={0}
            tilt={0}
            radius={outerRad}
            topRadius={outerRad}
            bottomRadius={outerRad}
            glass={config.glass}
            refraction={config.thicknessStep >= 9 ? config.refraction * 2.85 : config.refraction * (0.70 + (config.thicknessStep / 10) * 0.75)}
            bevel={Math.round(config.thicknessStep >= 9 ? config.bevel * 2.3 : config.bevel * (0.75 + (config.thicknessStep / 10) * 0.55))}
            dispersion={config.dispersion}
            blur={0}
            clearCenter={config.clearCenter}
            paused={false}
            speed={0}
            oilCoverage={0}
            oilOpacity={0}
            iridescence={0}
            glintIntensity={0}
            reflectivity={0.0}
            thickness={config.thickness}
            tint={darkTintRgba}
            className="absolute inset-0 w-full h-full pointer-events-none overflow-hidden"
            style={{
              borderRadius: `${innerRad}px ${outerRad}px ${outerRad}px ${innerRad}px`,
              border: `1px solid ${borderColorRgba}`,
              backdropFilter: config.blur > 0 ? `blur(${config.blur}px)` : undefined,
              WebkitBackdropFilter: config.blur > 0 ? `blur(${config.blur}px)` : undefined,
              transition: 'border-radius 240ms ease',
            }}
          />
          <div className="relative z-10 flex items-center justify-center gap-2 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8] animate-pulse" />
            <span className="font-mono text-xs font-bold text-white tracking-widest uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              Glass B
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};
