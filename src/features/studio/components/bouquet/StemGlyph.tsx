import type { ReactElement } from "react";
import type { StemType } from "../../bouquet/types";

/**
 * Pure flower-head marks. Every glyph is authored at the same neutral scale
 * (~28px across) — sizing differences between types come entirely from the
 * `scale` the layout engine already computed, never from the artwork, so
 * the two concerns (how big vs. what it looks like) stay separate.
 *
 * These know nothing about bouquet data, layout, or price — only how to
 * draw one flower head — so new artwork can be swapped in per type without
 * touching the engine or the interaction layer above it.
 */

function RosePetals({ count, fill, radius, petalRx, petalRy, opacity = 1 }: {
  count: number;
  fill: string;
  radius: number;
  petalRx: number;
  petalRy: number;
  opacity?: number;
}) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => {
        const angle = (360 / count) * i;
        return (
          <g key={i} transform={`rotate(${angle})`}>
            <ellipse cx={0} cy={-radius} rx={petalRx} ry={petalRy} fill={fill} opacity={opacity} />
          </g>
        );
      })}
    </>
  );
}

function RoseGlyph() {
  return (
    <g>
      <RosePetals count={7} fill="#9c2f4e" radius={7.5} petalRx={4.6} petalRy={7} opacity={0.9} />
      <RosePetals count={5} fill="#b3355a" radius={4.5} petalRx={3.6} petalRy={5} />
      <circle r={2.6} fill="#5c1a2c" />
    </g>
  );
}

function TulipGlyph() {
  return (
    <g>
      <path
        d="M -6.5 6 C -8 -1 -5.5 -8 0 -11 C 5.5 -8 8 -1 6.5 6 C 4 3 2 2 0 2 C -2 2 -4 3 -6.5 6 Z"
        fill="#e8677d"
      />
      <path d="M 0 -11 C -1.6 -6 -1.6 0 0 3 C 1.6 0 1.6 -6 0 -11 Z" fill="#f4a3ae" opacity={0.8} />
    </g>
  );
}

function LilyGlyph() {
  return (
    <g>
      {Array.from({ length: 6 }, (_, i) => {
        const angle = (360 / 6) * i;
        return (
          <g key={i} transform={`rotate(${angle})`}>
            <path d="M 0 0 C -3 -5 -2.4 -10 0 -13 C 2.4 -10 3 -5 0 0 Z" fill="#f7e8ec" stroke="#e3b9c4" strokeWidth={0.4} />
          </g>
        );
      })}
      {Array.from({ length: 5 }, (_, i) => {
        const angle = (360 / 5) * i + 20;
        const r = 3.4;
        return (
          <circle
            key={i}
            cx={Math.sin((angle * Math.PI) / 180) * r}
            cy={-Math.cos((angle * Math.PI) / 180) * r}
            r={0.55}
            fill="#c9743f"
          />
        );
      })}
    </g>
  );
}

function GerberaGlyph() {
  return (
    <g>
      <RosePetals count={12} fill="#e8a7b8" radius={7} petalRx={1.7} petalRy={6.4} />
      <circle r={3.2} fill="#3d2b2f" />
    </g>
  );
}

function CarnationGlyph() {
  return (
    <g>
      {Array.from({ length: 10 }, (_, i) => {
        const angle = (360 / 10) * i;
        return (
          <g key={i} transform={`rotate(${angle})`}>
            <path d="M -3 -2 L 0 -8 L 3 -2 L 1.3 -2.5 L 0 -1 L -1.3 -2.5 Z" fill="#f2b6c6" />
          </g>
        );
      })}
      <circle r={2} fill="#e07f97" />
    </g>
  );
}

function EucalyptusGlyph() {
  const leaves = [-8, -4, 0, 4, 8];
  return (
    <g>
      <line x1={0} y1={10} x2={0} y2={-10} stroke="#6f8f6a" strokeWidth={1} />
      {leaves.map((y, i) => (
        <g key={i}>
          <circle cx={-3.4} cy={y} r={2.6} fill="#8fa88b" />
          <circle cx={3.4} cy={y} r={2.6} fill="#a3bd9d" />
        </g>
      ))}
    </g>
  );
}

function BabysBreathGlyph() {
  const points = [
    [0, -6],
    [-4, -3],
    [4, -3],
    [-6, 1],
    [6, 1],
    [-2, 4],
    [2, 4],
  ];
  return (
    <g>
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={1.5} fill="#fffdf8" stroke="#e3d9cf" strokeWidth={0.4} />
      ))}
    </g>
  );
}

function GreeneryGlyph() {
  return (
    <g>
      {[-1, 1].map((side) =>
        Array.from({ length: 3 }, (_, i) => {
          const angle = side * (18 + i * 16);
          return (
            <g key={`${side}-${i}`} transform={`rotate(${angle})`}>
              <path d="M 0 4 C -2.4 -2 -1.6 -9 0 -13 C 1.6 -9 2.4 -2 0 4 Z" fill="#075838" opacity={0.85} />
            </g>
          );
        }),
      )}
    </g>
  );
}

const GLYPHS: Record<StemType, () => ReactElement> = {
  rose: RoseGlyph,
  tulip: TulipGlyph,
  lily: LilyGlyph,
  gerbera: GerberaGlyph,
  carnation: CarnationGlyph,
  eucalyptus: EucalyptusGlyph,
  "babys-breath": BabysBreathGlyph,
  greenery: GreeneryGlyph,
};

export default function StemGlyph({ type }: { type: StemType }) {
  const Glyph = GLYPHS[type];
  return <Glyph />;
}
