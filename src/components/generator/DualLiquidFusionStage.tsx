import React, { useState, useRef, useId, useCallback } from 'react';
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
 * Builds the authentic Molten Liquid Glass boundary path.
 * When separated (gap >= threshold): Returns two separate rounded pills.
 * When in contact range (gap < threshold): Returns a seamless fluid contour
 * with smooth concave C1/C2 catenoid arcs bridging from top corner to top corner,
 * and bottom corner to bottom corner, with ZERO interior dividing lines.
 */
function createLiquidFusionPath(
  x1: number,
  x2: number,
  boxW: number,
  boxH: number,
  radius: number,
  threshold: number
): { path: string; isBridged: boolean; gap: number } {
  const leftX = Math.min(x1, x2);
  const rightX = Math.max(x1, x2);

  // Left box bounds
  const aLeft = leftX - boxW / 2;
  const aRight = leftX + boxW / 2;

  // Right box bounds
  const bLeft = rightX - boxW / 2;
  const bRight = rightX + boxW / 2;

  const gap = Math.max(0, bLeft - aRight);
  const isBridged = gap < threshold;

  // Case 1: Fully Separated (Two independent rounded pills)
  if (!isBridged) {
    const pillA = `M ${aLeft + radius} 0 L ${aRight - radius} 0 Q ${aRight} 0 ${aRight} ${radius} L ${aRight} ${boxH - radius} Q ${aRight} ${boxH} ${aRight - radius} ${boxH} L ${aLeft + radius} ${boxH} Q ${aLeft} ${boxH} ${aLeft} ${boxH - radius} L ${aLeft} ${radius} Q ${aLeft} 0 ${aLeft + radius} 0 Z`;
    const pillB = `M ${bLeft + radius} 0 L ${bRight - radius} 0 Q ${bRight} 0 ${bRight} ${radius} L ${bRight} ${boxH - radius} Q ${bRight} ${boxH} ${bRight - radius} ${boxH} L ${bLeft + radius} ${boxH} Q ${bLeft} ${boxH} ${bLeft} ${boxH - radius} L ${bLeft} ${radius} Q ${bLeft} 0 ${bLeft + radius} 0 Z`;
    return { path: `${pillA} ${pillB}`, isBridged: false, gap };
  }

  // Case 2: Fully Coalesced into one seamless capsule (gap near zero)
  if (gap <= 0.5) {
    const singlePill = `M ${aLeft + radius} 0 L ${bRight - radius} 0 Q ${bRight} 0 ${bRight} ${radius} L ${bRight} ${boxH - radius} Q ${bRight} ${boxH} ${bRight - radius} ${boxH} L ${aLeft + radius} ${boxH} Q ${aLeft} ${boxH} ${aLeft} ${boxH - radius} L ${aLeft} ${radius} Q ${aLeft} 0 ${aLeft + radius} 0 Z`;
    return { path: singlePill, isBridged: true, gap };
  }

  // Case 3: Viscous Liquid Glass Meniscus Bridge (0.5 < gap < threshold)
  // Continuous Young-Laplace catenoid bridge linking top and bottom corners
  const t = Math.max(0, Math.min(1, (threshold - gap) / threshold));
  const u = Math.pow(t, 1.3); // Viscous fluid ease

  // Fillet tangent attachment points
  const blendW = Math.max(radius * 0.65, radius * (1.1 - u * 0.4));
  const pTopLeft = Math.max(aLeft + radius, aRight - blendW);
  const pTopRight = Math.min(bRight - radius, bLeft + blendW);
  const midX = (aRight + bLeft) / 2;

  // Neck dip: starts deep at large gap, smoothly flattens to 0 at gap = 0
  const dipY = Math.max(0, radius * Math.pow(1 - u, 1.4) * 0.85);

  const spanLeft = midX - pTopLeft;
  const spanRight = pTopRight - midX;

  let d = `M ${aLeft + radius} 0 `;
  // 1. Top edge of Box A
  d += `L ${pTopLeft} 0 `;

  // 2. TOP MENISCUS BRIDGE: Smooth concave arc dipping down into the gap
  d += `C ${pTopLeft + spanLeft * 0.45} 0, ${midX - spanLeft * 0.35} ${dipY}, ${midX} ${dipY} `;
  d += `C ${midX + spanRight * 0.35} ${dipY}, ${pTopRight - spanRight * 0.45} 0, ${pTopRight} 0 `;

  // 3. Top edge and outer right cap of Box B
  d += `L ${bRight - radius} 0 `;
  d += `Q ${bRight} 0 ${bRight} ${radius} `;
  d += `L ${bRight} ${boxH - radius} `;
  d += `Q ${bRight} ${boxH} ${bRight - radius} ${boxH} `;

  // 4. Bottom edge of Box B heading left toward bridge
  d += `L ${pTopRight} ${boxH} `;

  // 5. BOTTOM MENISCUS BRIDGE: Smooth concave arc dipping up into the gap
  d += `C ${pTopRight - spanRight * 0.45} ${boxH}, ${midX + spanRight * 0.35} ${boxH - dipY}, ${midX} ${boxH - dipY} `;
  d += `C ${midX - spanLeft * 0.35} ${boxH - dipY}, ${pTopLeft + spanLeft * 0.45} ${boxH}, ${pTopLeft} ${boxH} `;

  // 6. Bottom edge and outer left cap of Box A
  d += `L ${aLeft + radius} ${boxH} `;
  d += `Q ${aLeft} ${boxH} ${aLeft} ${boxH - radius} `;
  d += `L ${aLeft} ${radius} `;
  d += `Q ${aLeft} 0 ${aLeft + radius} 0 Z`;

  return { path: d, isBridged: true, gap };
}

export const DualLiquidFusionStage: React.FC<DualLiquidFusionStageProps> = ({
  canvasRef,
  config,
  shadowTone,
  isShadowInverted,
  darkTintRgba,
  borderColorRgba,
}) => {
  // Independent X positions for Glass A and Glass B (centered around 0)
  const [posX, setPosX] = useState({ a: -90, b: 90 });
  const [activeTarget, setActiveTarget] = useState<'a' | 'b' | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragInfoRef = useRef<{ clientX: number; startPos: number; target: 'a' | 'b' } | null>(null);

  const boxW = 145;
  const boxH = 68;
  const radius = Math.round(boxH / 2); // 34px pill radius
  const threshold = 60; // Active fusion reach threshold in px

  const clipId = useId().replace(/:/g, '_');

  // Multi-Touch and Mouse Dragging
  const startDrag = (target: 'a' | 'b') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);

    dragInfoRef.current = {
      clientX: e.clientX,
      startPos: target === 'a' ? posX.a : posX.b,
      target,
    };
    setActiveTarget(target);
  };

  const onDragMove = (e: React.PointerEvent) => {
    if (!dragInfoRef.current) return;
    const { clientX: startX, startPos, target } = dragInfoRef.current;
    const dx = e.clientX - startX;
    const nextVal = startPos + dx;

    setPosX((prev) => {
      if (target === 'a') {
        // Stop at collision point so they don't awkwardly slide on top of each other
        const maxA = prev.b - boxW;
        return { ...prev, a: Math.max(-260, Math.min(maxA, nextVal)) };
      } else {
        const minB = prev.a + boxW;
        return { ...prev, b: Math.max(minB, Math.min(260, nextVal)) };
      }
    });
  };

  const stopDrag = (e: React.PointerEvent) => {
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (_) {}
    dragInfoRef.current = null;
    setActiveTarget(null);
  };

  // Center alignment and bounds
  const stageMinX = Math.min(posX.a, posX.b) - boxW / 2;
  const stageMaxX = Math.max(posX.a, posX.b) + boxW / 2;
  const stageW = stageMaxX - stageMinX;

  // Convert to local SVG coordinates where 0 is stageMinX
  const localA = posX.a - stageMinX;
  const localB = posX.b - stageMinX;

  const { path: fusionPath, isBridged, gap } = createLiquidFusionPath(
    localA,
    localB,
    boxW,
    boxH,
    radius,
    threshold
  );

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-[150px] flex items-center justify-center select-none overflow-visible pointer-events-auto my-auto"
    >
      {/* SVG Definitions for Dynamic Unified Fluid ClipPath and Specular Rim */}
      <svg width="0" height="0" className="absolute pointer-events-none">
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <path d={fusionPath} />
          </clipPath>
          <linearGradient id="specularRim" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.75)" />
            <stop offset="30%" stopColor="rgba(34, 211, 238, 0.50)" />
            <stop offset="70%" stopColor="rgba(56, 189, 248, 0.60)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.55)" />
          </linearGradient>
        </defs>
      </svg>

      {/* UNIFIED LIQUID GLASS CONTAINER:
          Positioned accurately in the center, hosting the single uninterrupted liquid glass surface */}
      <div
        className="relative flex items-center pointer-events-auto"
        style={{
          width: `${stageW}px`,
          height: `${boxH}px`,
          transform: `translate3d(${stageMinX + stageW / 2}px, 0, 0)`,
          willChange: 'width, transform',
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
          style={{ width: `${stageW}px`, height: `${boxH}px` }}
        >
          <path
            d={fusionPath}
            fill="none"
            stroke="url(#specularRim)"
            strokeWidth={1.4}
            style={{
              filter: isBridged ? 'drop-shadow(0 0 10px rgba(6, 182, 212, 0.45))' : 'none',
              transition: activeTarget ? 'none' : 'filter 240ms ease',
            }}
          />
        </svg>

        {/* Layer 3: Interactive Glass Cores (Glass A & Glass B) with Touch/Mouse Tracking */}
        {/* Core A */}
        <div
          onPointerDown={startDrag('a')}
          onPointerMove={onDragMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          className="absolute z-20 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
          style={{
            left: `${localA - boxW / 2}px`,
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

        {/* Core B */}
        <div
          onPointerDown={startDrag('b')}
          onPointerMove={onDragMove}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
          className="absolute z-20 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none select-none"
          style={{
            left: `${localB - boxW / 2}px`,
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
