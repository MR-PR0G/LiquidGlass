import React, { useState, useRef, useId, useEffect, useCallback } from 'react';
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
 * Calculates continuous C1/C2 Young-Laplace Meniscus Bridge Path between two liquid glass boxes:
 * - Box A: centered at posA, size [boxW, boxH]
 * - Box B: centered at posB, size [boxW, boxH]
 * - When edgeGap >= threshold: Returns two separate rounded pills.
 * - When edgeGap < threshold: Returns a unified fluid skin with organic capillary curves merging them.
 */
function computeMeniscusPath(
  posA: number,
  posB: number,
  boxW: number,
  boxH: number,
  radius: number,
  threshold: number,
  originX: number
): string {
  // Ensure A is always left of B
  const leftPos = Math.min(posA, posB);
  const rightPos = Math.max(posA, posB);

  // Absolute coordinates relative to SVG origin
  const x1Left = (leftPos - boxW / 2) - originX;
  const x1Right = (leftPos + boxW / 2) - originX;
  const x2Left = (rightPos - boxW / 2) - originX;
  const x2Right = (rightPos + boxW / 2) - originX;

  const gap = Math.max(0, x2Left - x1Right);

  // 1. Fully separated: Two distinct rounded pills
  if (gap >= threshold) {
    const p1 = `M ${x1Left + radius} 0 L ${x1Right - radius} 0 Q ${x1Right} 0 ${x1Right} ${radius} L ${x1Right} ${boxH - radius} Q ${x1Right} ${boxH} ${x1Right - radius} ${boxH} L ${x1Left + radius} ${boxH} Q ${x1Left} ${boxH} ${x1Left} ${boxH - radius} L ${x1Left} ${radius} Q ${x1Left} 0 ${x1Left + radius} 0 Z`;
    const p2 = `M ${x2Left + radius} 0 L ${x2Right - radius} 0 Q ${x2Right} 0 ${x2Right} ${radius} L ${x2Right} ${boxH - radius} Q ${x2Right} ${boxH} ${x2Right - radius} ${boxH} L ${x2Left + radius} ${boxH} Q ${x2Left} ${boxH} ${x2Left} ${boxH - radius} L ${x2Left} ${radius} Q ${x2Left} 0 ${x2Left + radius} 0 Z`;
    return `${p1} ${p2}`;
  }

  // 2. Fully merged into single pill
  if (gap <= 0.5) {
    return `M ${x1Left + radius} 0 L ${x2Right - radius} 0 Q ${x2Right} 0 ${x2Right} ${radius} L ${x2Right} ${boxH - radius} Q ${x2Right} ${boxH} ${x2Right - radius} ${boxH} L ${x1Left + radius} ${boxH} Q ${x1Left} ${boxH} ${x1Left} ${boxH - radius} L ${x1Left} ${radius} Q ${x1Left} 0 ${x1Left + radius} 0 Z`;
  }

  // 3. Fluid Meniscus Bridge: Soft concave meniscus curves linking top and bottom corners
  const t = Math.max(0, Math.min(1, (threshold - gap) / threshold));
  const u = Math.pow(t, 1.25); // Organic viscous progression

  // Tangential blend span on the corners
  const blendSpan = Math.max(radius * 0.7, radius * (1.15 - u * 0.45));
  const xTopL = Math.max(x1Left + radius, x1Right - blendSpan);
  const xTopR = Math.min(x2Right - radius, x2Left + blendSpan);
  const xMid = (x1Right + x2Left) / 2;

  // Neck dip depth: curves gracefully from inner corner down toward center, flattening as gap -> 0
  const dipY = Math.max(0, radius * Math.pow(1 - u, 1.35) * 0.88);

  const dxL = xMid - xTopL;
  const dxR = xTopR - xMid;

  let d = `M ${x1Left + radius} 0 `;
  d += `L ${xTopL} 0 `;

  // TOP MENISCUS FILLET (concave liquid bridge)
  if (dipY > 0.05) {
    d += `C ${xTopL + dxL * 0.45} 0, ${xMid - dxL * 0.4} ${dipY}, ${xMid} ${dipY} `;
    d += `C ${xMid + dxR * 0.4} ${dipY}, ${xTopR - dxR * 0.45} 0, ${xTopR} 0 `;
  } else {
    d += `L ${xTopR} 0 `;
  }

  // RIGHT BOX OUTER CAP
  d += `L ${x2Right - radius} 0 `;
  d += `Q ${x2Right} 0 ${x2Right} ${radius} `;
  d += `L ${x2Right} ${boxH - radius} `;
  d += `Q ${x2Right} ${boxH} ${x2Right - radius} ${boxH} `;
  d += `L ${xTopR} ${boxH} `;

  // BOTTOM MENISCUS FILLET (concave liquid bridge)
  if (dipY > 0.05) {
    d += `C ${xTopR - dxR * 0.45} ${boxH}, ${xMid + dxR * 0.4} ${boxH - dipY}, ${xMid} ${boxH - dipY} `;
    d += `C ${xMid - dxL * 0.4} ${boxH - dipY}, ${xTopL + dxL * 0.45} ${boxH}, ${xTopL} ${boxH} `;
  } else {
    d += `L ${xTopL} ${boxH} `;
  }

  // LEFT BOX OUTER CAP
  d += `L ${x1Left + radius} ${boxH} `;
  d += `Q ${x1Left} ${boxH} ${x1Left} ${boxH - radius} `;
  d += `L ${x1Left} ${radius} `;
  d += `Q ${x1Left} 0 ${x1Left + radius} 0 Z`;

  return d;
}

export const DualLiquidFusionStage: React.FC<DualLiquidFusionStageProps> = ({
  canvasRef,
  config,
  shadowTone,
  isShadowInverted,
  darkTintRgba,
  borderColorRgba,
}) => {
  // Independent X positions for Box A and Box B (in device pixels from container center)
  const [posX, setPosX] = useState({ a: -95, b: 95 });
  const [draggingTarget, setDraggingTarget] = useState<'a' | 'b' | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const activePointersRef = useRef<Map<number, { target: 'a' | 'b'; startClientX: number; startPos: number }>>(new Map());

  const boxW = 145;
  const boxH = 68;
  const radius = Math.round(boxH / 2);
  const threshold = 52; // Active capillary reach in px

  const clipId = useId().replace(/:/g, '_');

  // Multi-touch & Mouse Event Handlers with separate pointer tracking
  const handlePointerDown = (target: 'a' | 'b') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    
    activePointersRef.current.set(e.pointerId, {
      target,
      startClientX: e.clientX,
      startPos: target === 'a' ? posX.a : posX.b,
    });
    setDraggingTarget(target);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const pointerData = activePointersRef.current.get(e.pointerId);
    if (!pointerData) return;

    const dx = e.clientX - pointerData.startClientX;
    const newPos = pointerData.startPos + dx;

    setPosX((prev) => {
      if (pointerData.target === 'a') {
        // Box A cannot push through Box B (stop at contact point)
        const maxA = prev.b - boxW;
        const clampedA = Math.max(-260, Math.min(maxA, newPos));
        return { ...prev, a: clampedA };
      } else {
        // Box B cannot push through Box A (stop at contact point)
        const minB = prev.a + boxW;
        const clampedB = Math.max(minB, Math.min(260, newPos));
        return { ...prev, b: clampedB };
      }
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    activePointersRef.current.delete(e.pointerId);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    if (activePointersRef.current.size === 0) {
      setDraggingTarget(null);
    }
  };

  // Geometry calculations for unified canvas/SVG wrapper
  const minLeft = Math.min(posX.a, posX.b) - boxW / 2;
  const maxRight = Math.max(posX.a, posX.b) + boxW / 2;
  const totalW = Math.max(boxW * 2, maxRight - minLeft);
  const originX = minLeft;

  const currentGap = Math.max(0, (Math.max(posX.a, posX.b) - boxW / 2) - (Math.min(posX.a, posX.b) + boxW / 2));
  const isFused = currentGap < threshold;
  const pathD = computeMeniscusPath(posX.a, posX.b, boxW, boxH, radius, threshold, originX);

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-[150px] flex items-center justify-center select-none overflow-visible pointer-events-auto my-auto"
    >
      {/* SVG ClipPath Definition for the dynamic unified liquid glass boundary */}
      <svg width="0" height="0" className="absolute pointer-events-none">
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path d={pathD} />
          </clipPath>
          <linearGradient id="specularRim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.70)" />
            <stop offset="30%" stopColor="rgba(34, 211, 238, 0.45)" />
            <stop offset="70%" stopColor="rgba(56, 189, 248, 0.55)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.50)" />
          </linearGradient>
        </defs>
      </svg>

      {/* UNIFIED PHYSICAL LIQUID GLASS BODY:
          Follows the two boxes' collective bounds with zero jump and zero lag */}
      <div
        className="relative flex items-center pointer-events-auto"
        style={{
          width: `${totalW}px`,
          height: `${boxH}px`,
          transform: `translate3d(${originX + totalW / 2}px, 0, 0)`,
          willChange: 'width, transform',
        }}
      >
        {/* Layer 1: True WebGL Physical Snell Refraction masked exactly to the Young-Laplace boundary */}
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
          style={{ width: `${totalW}px`, height: `${boxH}px` }}
        >
          <path
            d={pathD}
            fill="none"
            stroke="url(#specularRim)"
            strokeWidth={1.35}
            style={{
              filter: isFused ? 'drop-shadow(0 0 8px rgba(6, 182, 212, 0.45))' : 'none',
              transition: draggingTarget ? 'none' : 'filter 240ms ease',
            }}
          />
        </svg>

        {/* Layer 3: Interactive Glass Cores (Glass A & Glass B) with Touch/Mouse Tracking */}
        {/* Box A Core Handle */}
        <div
          onPointerDown={handlePointerDown('a')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute z-20 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
          style={{
            left: `${posX.a - originX - boxW / 2}px`,
            top: 0,
            width: `${boxW}px`,
            height: `${boxH}px`,
          }}
          title="Drag Glass A with finger or mouse"
        >
          <div className="flex items-center justify-center gap-2 pointer-events-none">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
            <span className="font-mono text-xs font-bold text-white tracking-widest uppercase drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              Glass A
            </span>
          </div>
        </div>

        {/* Box B Core Handle */}
        <div
          onPointerDown={handlePointerDown('b')}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute z-20 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
          style={{
            left: `${posX.b - originX - boxW / 2}px`,
            top: 0,
            width: `${boxW}px`,
            height: `${boxH}px`,
          }}
          title="Drag Glass B with finger or mouse"
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
