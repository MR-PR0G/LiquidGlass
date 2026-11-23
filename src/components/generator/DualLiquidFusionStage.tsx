import React, { useState, useRef, useId } from 'react';
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
 * Pure Mathematical Young-Laplace Meniscus Bridge Path.
 * Generates the unified liquid glass perimeter with smooth C1/C2 tangential fillets.
 */
function getUnifiedFusionPath(
  boxW: number,
  boxH: number,
  gap: number,
  radius: number,
  threshold: number
): string {
  const w1 = boxW;
  const w2 = boxW;
  const x2 = w1 + gap;

  // 1. Fully separated when gap >= threshold (Two 100% distinct rounded glass pills)
  if (gap >= threshold) {
    const p1 = `M ${radius} 0 L ${w1 - radius} 0 Q ${w1} 0 ${w1} ${radius} L ${w1} ${boxH - radius} Q ${w1} ${boxH} ${w1 - radius} ${boxH} L ${radius} ${boxH} Q 0 ${boxH} 0 ${boxH - radius} L 0 ${radius} Q 0 0 ${radius} 0 Z`;
    const p2 = `M ${x2 + radius} 0 L ${x2 + w2 - radius} 0 Q ${x2 + w2} 0 ${x2 + w2} ${radius} L ${x2 + w2} ${boxH - radius} Q ${x2 + w2} ${boxH} ${x2 + w2 - radius} ${boxH} L ${x2 + radius} ${boxH} Q ${x2} ${boxH} ${x2} ${boxH - radius} L ${x2} ${radius} Q ${x2} 0 ${x2 + radius} 0 Z`;
    return `${p1} ${p2}`;
  }

  // 2. Fully merged into one cohesive pill when gap <= 0.5
  if (gap <= 0.5) {
    return `M ${radius} 0 L ${x2 + w2 - radius} 0 Q ${x2 + w2} 0 ${x2 + w2} ${radius} L ${x2 + w2} ${boxH - radius} Q ${x2 + w2} ${boxH} ${x2 + w2 - radius} ${boxH} L ${radius} ${boxH} Q 0 ${boxH} 0 ${boxH - radius} L 0 ${radius} Q 0 0 ${radius} 0 Z`;
  }

  // 3. Continuous Tangential Meniscus Fillet (0.5 < gap < threshold)
  // Perfectly smooth C1/C2 curvature: ZERO sharp internal corners, zero abrupt cusps
  const t = Math.max(0, Math.min(1, (threshold - gap) / threshold));
  const u = Math.pow(t, 1.25);

  const blendSpan = Math.max(radius * 0.75, radius * (1.15 - u * 0.45));
  const xTopL = Math.max(radius, w1 - blendSpan);
  const xTopR = Math.min(x2 + w2 - radius, x2 + blendSpan);
  const xMid = (w1 + x2) / 2;

  // Neck dip depth: starts as soft meniscus and flattens to 0 at gap = 0
  const dipY = Math.max(0, radius * Math.pow(1 - u, 1.35) * 0.88);

  const dxL = xMid - xTopL;
  const dxR = xTopR - xMid;

  let d = `M ${radius} 0 `;
  d += `L ${xTopL} 0 `;

  // TOP MENISCUS FILLET
  if (dipY > 0.05) {
    d += `C ${xTopL + dxL * 0.45} 0, ${xMid - dxL * 0.4} ${dipY}, ${xMid} ${dipY} `;
    d += `C ${xMid + dxR * 0.4} ${dipY}, ${xTopR - dxR * 0.45} 0, ${xTopR} 0 `;
  } else {
    d += `L ${xTopR} 0 `;
  }

  // RIGHT CARD OUTER RIM
  d += `L ${x2 + w2 - radius} 0 `;
  d += `Q ${x2 + w2} 0 ${x2 + w2} ${radius} `;
  d += `L ${x2 + w2} ${boxH - radius} `;
  d += `Q ${x2 + w2} ${boxH} ${x2 + w2 - radius} ${boxH} `;
  d += `L ${xTopR} ${boxH} `;

  // BOTTOM MENISCUS FILLET
  if (dipY > 0.05) {
    d += `C ${xTopR - dxR * 0.45} ${boxH}, ${xMid + dxR * 0.4} ${boxH - dipY}, ${xMid} ${boxH - dipY} `;
    d += `C ${xMid - dxL * 0.4} ${boxH - dipY}, ${xTopL + dxL * 0.45} ${boxH}, ${xTopL} ${boxH} `;
  } else {
    d += `L ${xTopL} ${boxH} `;
  }

  // LEFT CARD FINISH
  d += `L ${radius} ${boxH} `;
  d += `Q 0 ${boxH} 0 ${boxH - radius} `;
  d += `L 0 ${radius} `;
  d += `Q 0 0 ${radius} 0 Z`;

  return d;
}

/**
 * Authentic Coalescent Liquid Glass Fusion Stage:
 * The glass perimeter itself is dynamically cut out by the mathematical Young-Laplace path!
 * - When distant: Two separate, distinct liquid glass rounded bodies.
 * - When dragged close: The liquid glass perimeter bridges the gap and coalesces into a single unified molten glass capsule!
 * - Physical Snell ray-tracing runs inside the united liquid boundary with specular rim illumination.
 */
export const DualLiquidFusionStage: React.FC<DualLiquidFusionStageProps> = ({
  canvasRef,
  config,
  shadowTone,
  isShadowInverted,
  darkTintRgba,
  borderColorRgba,
}) => {
  const [gap, setGap] = useState(48); // Initial gap in px
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ clientX: number; initGap: number }>({ clientX: 0, initGap: 48 });

  const boxW = 155;
  const boxH = 68;
  const radius = Math.round(boxH / 2);
  const threshold = 40; // Proximity threshold where molten glass merges

  const clipId = useId().replace(/:/g, '_');

  // Drag interaction to adjust the gap between the two glass cores
  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartRef.current = { clientX: e.clientX, initGap: gap };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = Math.abs(e.clientX - dragStartRef.current.clientX);
    // Moving inwards closes gap; moving outwards opens gap
    const dir = e.clientX > dragStartRef.current.clientX ? 1 : -1;
    const newGap = Math.max(0, Math.min(120, dragStartRef.current.initGap + (e.clientX - dragStartRef.current.clientX) * 1.5));
    setGap(newGap);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging) {
      try { (e.target as HTMLElement).releasePointerCapture(e.pointerId); } catch (_) {}
      setIsDragging(false);
    }
  };

  const totalWidth = boxW * 2 + gap;
  const pathD = getUnifiedFusionPath(boxW, boxH, gap, radius, threshold);
  const isFused = gap < threshold;

  return (
    <div 
      className="relative w-full h-[150px] flex items-center justify-center select-none overflow-visible pointer-events-auto my-auto"
    >
      {/* SVG ClipPath Definition for the dynamic unified liquid glass boundary */}
      <svg width="0" height="0" className="absolute pointer-events-none">
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path d={pathD} />
          </clipPath>
          <linearGradient id="specularRim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.65)" />
            <stop offset="40%" stopColor="rgba(34, 211, 238, 0.40)" />
            <stop offset="70%" stopColor="rgba(56, 189, 248, 0.50)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.40)" />
          </linearGradient>
        </defs>
      </svg>

      {/* UNIFIED LIQUID GLASS CONTAINER - Physical Snell Refraction Layer inside the Young-Laplace boundary */}
      <div
        className="relative flex items-center justify-between pointer-events-auto"
        style={{
          width: `${totalWidth}px`,
          height: `${boxH}px`,
          transition: isDragging ? 'none' : 'width 260ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Layer 1: True WebGL Physical Snell Refraction masked exactly to the unified molten boundary */}
        <div
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{
            clipPath: `url(#${clipId})`,
            WebkitClipPath: `url(#${clipId})`,
            boxShadow: computeGlassBoxShadow(config.shadowStep, shadowTone, config.borderOpacity, config.thicknessStep, isShadowInverted),
          }}
        >
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
              backgroundColor: darkTintRgba,
              backdropFilter: config.blur > 0 ? `blur(${config.blur}px)` : undefined,
              WebkitBackdropFilter: config.blur > 0 ? `blur(${config.blur}px)` : undefined,
            }}
          />
        </div>

        {/* Layer 2: Continuous Glowing Specular Rim Contour tracing the entire liquid boundary */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none overflow-visible z-10"
          style={{ width: `${totalWidth}px`, height: `${boxH}px` }}
        >
          <path
            d={pathD}
            fill="none"
            stroke="url(#specularRim)"
            strokeWidth={1.3}
            style={{
              filter: isFused ? 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.40))' : 'none',
              transition: isDragging ? 'none' : 'filter 240ms ease',
            }}
          />
        </svg>

        {/* Layer 3: Interactive Glass Cores (Glass A & Glass B) */}
        {/* Left Core: Glass A */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative z-20 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
          style={{ width: `${boxW}px`, height: `${boxH}px` }}
          title="Drag horizontally to fuse or separate the molten liquid glass"
        >
          <div className="flex items-center justify-center gap-2 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
            <span className="font-mono text-xs font-bold text-white tracking-widest uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              Glass A
            </span>
          </div>
        </div>

        {/* Right Core: Glass B */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="relative z-20 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
          style={{ width: `${boxW}px`, height: `${boxH}px` }}
          title="Drag horizontally to fuse or separate the molten liquid glass"
        >
          <div className="flex items-center justify-center gap-2 pointer-events-none">
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
