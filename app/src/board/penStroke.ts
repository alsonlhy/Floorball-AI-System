// Outline of a freehand pen stroke, in rink metres.
//
// perfect-freehand's internal thresholds (minimum point spacing, pressure simulation, start
// and end caps) are tuned for screen pixels. Fed raw metres (points ~0.05 m apart, a stroke
// ~0.3 m wide) it misjudges the start of a stroke and draws a large blob there. So the points
// are scaled to pixel-like units first and the outline scaled back.

import { getStroke } from 'perfect-freehand';
import type { Vec } from '../model/types';

/** perfect-freehand units per metre (about the on-screen scale on a tablet). */
export const PF_UNITS_PER_M = 50;

export function penOutline(
  points: Vec[],
  widthM: number,
  opts: { pressures?: number[]; complete?: boolean } = {},
): number[] {
  const k = PF_UNITS_PER_M;
  const { pressures, complete = true } = opts;
  const outline = getStroke(
    points.map((p, i) => [p.x * k, p.y * k, pressures?.[i] ?? 0.5]),
    {
      size: widthM * 1.8 * k,
      thinning: pressures ? 0.6 : 0.35,
      smoothing: 0.5,
      // Low streamline keeps the line under the finger instead of trailing behind it.
      streamline: 0.2,
      simulatePressure: !pressures,
      // A finished stroke gets its proper end cap; the live draft does not.
      last: complete,
    },
  );
  return outline.flatMap(([x, y]) => [x! / k, y! / k]);
}
