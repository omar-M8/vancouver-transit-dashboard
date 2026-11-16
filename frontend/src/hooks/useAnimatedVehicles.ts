import { useEffect, useRef, useState } from 'react';
import type { Position } from 'geojson';
import { VEHICLE_ANIMATION_MS, VEHICLE_MAX_GLIDE_DEGREES } from '../components/map/mapConfig';
import type { VehicleFeatureCollection } from '../types/transitMap';

/**
 * Maps linear progress (0 → 1) to eased progress (0 → 1): slow start, fast
 * middle, slow finish, so a bus "pulls away" and "pulls in" instead of moving
 * at a constant robotic speed.
 *   t = 0.25 → 0.125 (still slow)   t = 0.5 → 0.5   t = 0.75 → 0.875 (slowing down)
 */
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/**
 * Returns the vehicles to draw this frame. When `target` changes (a new poll
 * result), each vehicle glides from where it is currently drawn to its new
 * position over ~2s instead of jumping.
 *
 * Vehicles snap straight to the new position when they are new, haven't moved,
 * or moved implausibly far (a reassigned vehicle id), and everything snaps when
 * the user prefers reduced motion.
 *
 * How it fits together:
 *   poll every 30 s ──> `target` (real positions) ──> this hook ──> `frame` (in-between
 *   positions, ~60 per second for 2 s) ──> the map's vehicle <Source>
 */
export function useAnimatedVehicles(target: VehicleFeatureCollection): VehicleFeatureCollection {
  // `frame` is what the component renders. Updating it with setFrame() re-renders
  // the map with the vehicles moved a little further along.
  const [frame, setFrame] = useState(target);

  // What is on the map right now; an animation interrupted by new data continues from here.
  // A ref, not state: it's written every frame but nothing needs to re-render because of it.
  const drawn = useRef(target);

  // Runs once per new poll result (`target` only changes every ~30 s).
  useEffect(() => {
    // ── Step 1: remember where every vehicle is drawn right now ──────────────
    // Keyed by vehicleId so each vehicle in the new data can find its own old
    // position, even though the order of the features changes between polls.
    // Using `drawn` (not the previous poll's data) means that if a poll arrives
    // mid-glide, vehicles continue from their current spot instead of jumping back.
    const previous = new Map<string, Position>(
      drawn.current.features.map((f) => [f.properties.vehicleId, f.geometry.coordinates]),
    );

    // Accessibility: users who turn on "reduce motion" in their OS get no animation.
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── Step 2: decide which vehicles glide and where each one starts ────────
    // Start position per vehicle, or null for the ones that should not glide.
    // This array lines up with target.features by index, so step 4 can do
    // starts[index] instead of a lookup per vehicle per frame.
    const starts = target.features.map((feature): Position | null => {
      const from = previous.get(feature.properties.vehicleId);
      // No old position = the vehicle just appeared, so there is nothing to glide from.
      if (!from || reducedMotion) return null;

      const [toLon, toLat] = feature.geometry.coordinates;
      // A cheap distance in degrees: the bigger of the longitude and latitude change.
      // Accurate enough to tell "drove a few blocks" from "teleported".
      const distance = Math.max(Math.abs(toLon - from[0]), Math.abs(toLat - from[1]));

      // Glide only when it moved, but not more than ~1.5 km. A bigger jump in 30 s
      // usually means the id now belongs to another trip, and sliding a bus across
      // the city would look wrong.
      return distance > 0 && distance <= VEHICLE_MAX_GLIDE_DEGREES ? from : null;
    });

    // If nothing needs to glide, use a 0 ms "animation" so the first frame just
    // shows the new data.
    const duration = starts.some((start) => start !== null) ? VEHICLE_ANIMATION_MS : 0;

    // ── Step 3: run the animation loop ───────────────────────────────────────
    // requestAnimationFrame calls `tick` right before the browser paints, about
    // 60 times a second, and pauses automatically in background tabs.
    let request = 0; // id of the pending frame, so cleanup can cancel it
    const startedAt = performance.now();

    const tick = (now: number) => {
      // How far through the animation we are, from 0 to 1, based on real elapsed
      // time. A slow device drops frames but still finishes on time.
      const progress = duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
      const eased = easeInOut(progress);

      // ── Step 4: build this frame's positions ───────────────────────────────
      const next: VehicleFeatureCollection =
        progress >= 1
          // Done: show the real data itself (exact positions, no rounding drift).
          ? target
          : {
              type: 'FeatureCollection',
              features: target.features.map((feature, index) => {
                const from = starts[index];
                // Snapping vehicles are already at their final position.
                if (!from) return feature;

                // Linear interpolation: start + (end - start) × eased progress.
                // eased = 0 → old position, 0.5 → halfway, 1 → new position.
                const [toLon, toLat] = feature.geometry.coordinates;
                return {
                  // Keep every property (route, delay, headsign…); only move the point.
                  // A new object rather than a mutation, so React and MapLibre see a change.
                  ...feature,
                  geometry: {
                    type: 'Point',
                    coordinates: [from[0] + (toLon - from[0]) * eased, from[1] + (toLat - from[1]) * eased],
                  },
                };
              }),
            };

      // ── Step 5: draw it and schedule the next frame ────────────────────────
      drawn.current = next; // where vehicles are now, in case new data interrupts us
      setFrame(next); // re-render → the map's <Source> calls setData() with these positions
      if (progress < 1) request = requestAnimationFrame(tick); // keep going until progress hits 1
    };

    request = requestAnimationFrame(tick);

    // Cleanup: runs when the next poll arrives (or the map unmounts). Cancelling
    // the old loop stops two animations fighting over setFrame. The new effect
    // then starts from `drawn`, which is wherever the old animation got to.
    return () => cancelAnimationFrame(request);
  }, [target]);

  return frame;
}
