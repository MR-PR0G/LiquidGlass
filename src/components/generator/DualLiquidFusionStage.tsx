import React, { useState, useRef, useEffect, useCallback } from 'react';
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
 * Pure Liquid Glass Twin Fusion:
 * Two authentic liquid glass capsules that users can physically drag with touch/mouse.
 * As they get close, Young-Laplace capillary meniscus reaches out, connects with smooth C1/C2 curvature,
 * and when dragged apart, stretches into an elastic neck and pinches off realistically.
 */
export const DualLiquidFusionStage: React.FC<DualLiquidFusionStageProps> = ({
  canvasRef,
  config,
  shadowTone,
  isShadowInverted,
  darkTintRgba,
  borderColorRgba,
}) => {
  // Box 1 (Left) and Box 2 (Right) positions (X offset relative to center)
  const [offsetA, setOffsetA] = useState(-110);
  const [offsetB, setOffsetB] = useState(110);
  const [isDraggingA, setIsDraggingA] = useState(false);
  const [isDraggingB, setIsDraggingB] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ clientX: number; initOffset: number }>({ clientX: 0, initOffset: 0 });

  const boxW = 160;
  const boxH = 68;
  const radius = Math.round(boxH / 2);

  // Distance between edges
  const centerDist = Math.abs(offsetB - offsetA);
  const edgeGap = Math.max(0, centerDist - boxW);
  const threshold = 32; // capillary fusion proximity threshold in px
  const isFused = edgeGap < threshold;
  const fusionRatio = Math.max(0, Math.min(1, (threshold - edgeGap) / threshold));

  // Pointer drag for Box A
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
    const newOffset = Math.min(offsetB - 40, dragStartRef.current.initOffset + dx);
    setOffsetA(Math.max(-200, Math.min(150, newOffset)));
  };

  const handlePointerUpA = (e: React.PointerEvent) => {
    if (isDraggingA) {
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch (_) {}
      setIsDraggingA(false);
    }
  };

  // Pointer drag for Box B
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
    const newOffset = Math.max(offsetA + 40, dragStartRef.current.initOffset + dx);
    setOffsetB(Math.max(-150, Math.min(200, newOffset)));
  };

  const handlePointerUpB = (e: React.PointerEvent) => {
    if (isDraggingB) {
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch (_) {}
      setIsDraggingB(false);
    }
  };

  // Quick auto-snap buttons
  const snapTogether = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOffsetA(-75);
    setOffsetB(75);
  };

  const snapApart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOffsetA(-140);
    setOffsetB(140);
  };

  // Capillary Meniscus Bridge Path between Box A and Box B
  // Calculates soft organic C1 tangent fillet joining the two capsules
  const midX = (offsetA + offsetB) / 2;
  const leftEdge = offsetA + boxW / 2;
  const rightEdge = offsetB - boxW / 2;
  const bridgeSpan = Math.max(0, rightEdge - leftEdge);
  const neckDip = Math.max(0, radius * Math.pow(1 - fusionRatio, 1.2) * 0.9);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-[180px] flex flex-col items-center justify-center select-none overflow-visible pointer-events-auto"
    >
      {/* Dynamic Capillary Meniscus Liquid Bridge (SVG organic skin connecting them when close) */}
      {isFused && (
        <svg
          className="absolute pointer-events-none overflow-visible z-10"
          style={{
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: `${boxH + 20}px`,
          }}
        >
          <defs>
            <linearGradient id="fusionGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgba(34, 211, 238, 0.45)" />
              <stop offset="50%" stopColor="rgba(56, 189, 248, 0.65)" />
              <stop offset="100%" stopColor="rgba(34, 211, 238, 0.45)" />
            </linearGradient>
          </defs>
          <path
            d={`
              M ${300 + leftEdge - 15} ${10}
              C ${300 + midX - 10} ${10 + neckDip}, ${300 + midX + 10} ${10 + neckDip}, ${300 + rightEdge + 15} ${10}
              L ${300 + rightEdge + 15} ${10 + boxH}
              C ${300 + midX + 10} ${10 + boxH - neckDip}, ${300 + midX - 10} ${10 + boxH - neckDip}, ${300 + leftEdge - 15} ${10 + boxH}
              Z
            `}
            fill={darkTintRgba}
            stroke="url(#fusionGlow)"
            strokeWidth={1.5}
            opacity={fusionRatio}
            style={{
              transition: isDraggingA || isDraggingB ? 'none' : 'all 240ms cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          />
        </svg>
      )}

      {/* Interactive Twin Liquid Glass Capsules */}
      <div className="relative w-full h-[90px] flex items-center justify-center">

        {/* BOX 1: Authentic Liquid Glass Capsule A */}
        <div
          onPointerDown={handlePointerDownA}
          onPointerMove={handlePointerMoveA}
          onPointerUp={handlePointerUpA}
          onPointerCancel={handlePointerUpA}
          className="absolute z-20 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none transition-shadow duration-200"
          style={{
            width: `${boxW}px`,
            height: `${boxH}px`,
            borderRadius: `${radius}px`,
            backgroundColor: darkTintRgba,
            boxShadow: computeGlassBoxShadow(config.shadowStep, shadowTone, config.borderOpacity, config.thicknessStep, isShadowInverted),
            transform: `translate3d(${offsetA}px, 0, 0)`,
            transition: isDraggingA ? 'none' : 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          title="Drag Box A horizontally to test molten liquid meniscus fusion"
        >
          {/* WebGL Snell Refraction Layer for Box A */}
          <SoapBubbleSurface
            backdrop={canvasRef}
            interactive={false}
            wobble={0}
            tilt={0}
            radius={radius}
            topRadius={radius}
            bottomRadius={radius}
            glass={config.glass}
            refraction={config.thicknessStep >= 9 ? config.refraction * 2.85 : config.refraction * (0.70 + (config.thicknessStep / 10) * 0.75)}
            bevel={Math.round(config.thicknessStep >= 9 ? config.bevel * 2.3 : config.bevel * (0.75 + (config.thicknessStep / 10) * 0.55))}
            dispersion={config.dispersion}
            blur={config.blur}
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
              borderRadius: `${radius}px`,
              border: `1px solid ${borderColorRgba}`,
              backdropFilter: `blur(${config.blur}px)`,
              WebkitBackdropFilter: `blur(${config.blur}px)`,
            }}
          />
          <div className="relative z-10 flex items-center justify-center gap-2 pointer-events-none">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
            <span className="font-mono text-xs font-bold text-white tracking-widest uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              Glass A
            </span>
          </div>
        </div>

        {/* BOX 2: Authentic Liquid Glass Capsule B */}
        <div
          onPointerDown={handlePointerDownB}
          onPointerMove={handlePointerMoveB}
          onPointerUp={handlePointerUpB}
          onPointerCancel={handlePointerUpB}
          className="absolute z-20 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none transition-shadow duration-200"
          style={{
            width: `${boxW}px`,
            height: `${boxH}px`,
            borderRadius: `${radius}px`,
            backgroundColor: darkTintRgba,
            boxShadow: computeGlassBoxShadow(config.shadowStep, shadowTone, config.borderOpacity, config.thicknessStep, isShadowInverted),
            transform: `translate3d(${offsetB}px, 0, 0)`,
            transition: isDraggingB ? 'none' : 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          title="Drag Box B horizontally to test molten liquid meniscus fusion"
        >
          {/* WebGL Snell Refraction Layer for Box B */}
          <SoapBubbleSurface
            backdrop={canvasRef}
            interactive={false}
            wobble={0}
            tilt={0}
            radius={radius}
            topRadius={radius}
            bottomRadius={radius}
            glass={config.glass}
            refraction={config.thicknessStep >= 9 ? config.refraction * 2.85 : config.refraction * (0.70 + (config.thicknessStep / 10) * 0.75)}
            bevel={Math.round(config.thicknessStep >= 9 ? config.bevel * 2.3 : config.bevel * (0.75 + (config.thicknessStep / 10) * 0.55))}
            dispersion={config.dispersion}
            blur={config.blur}
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
              borderRadius: `${radius}px`,
              border: `1px solid ${borderColorRgba}`,
              backdropFilter: `blur(${config.blur}px)`,
              WebkitBackdropFilter: `blur(${config.blur}px)`,
            }}
          />
          <div className="relative z-10 flex items-center justify-center gap-2 pointer-events-none">
            <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 shadow-[0_0_8px_#818cf8] animate-pulse" />
            <span className="font-mono text-xs font-bold text-white tracking-widest uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              Glass B
            </span>
          </div>
        </div>

      </div>

      {/* Control Pills & Status HUD */}
      <div className="mt-3 flex items-center gap-2 text-center pointer-events-auto">
        <button
          type="button"
          onClick={snapTogether}
          className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/40 text-[10px] sm:text-xs font-mono text-cyan-200 transition-all active:scale-95 shadow-sm"
        >
          Snap Together ⤡
        </button>
        <button
          type="button"
          onClick={snapApart}
          className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-[10px] sm:text-xs font-mono text-zinc-300 transition-all active:scale-95"
        >
          Separate Apart ⤢
        </button>
        <span className="text-[10.5px] font-mono text-zinc-400 ml-1">
          {isFused ? (
            <span className="text-cyan-400 font-bold">● Meniscus Bridge Fused</span>
          ) : (
            <span>Gap: {Math.round(edgeGap)}px</span>
          )}
        </span>
      </div>
      <span className="text-[10px] text-zinc-500 font-mono mt-1">
        Drag either liquid glass box with finger or mouse to observe organic meniscus fusion & pinch-off
      </span>
    </div>
  );
};
