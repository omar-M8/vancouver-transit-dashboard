import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

/**
 * MapLibre v6 finds its web worker at runtime as a file next to its own bundle
 * (`new URL('./maplibre-gl-worker.mjs', import.meta.url)`). Vite can't see that
 * reference, so the worker is never served in dev or emitted by `vite build`,
 * and the map stays blank with "Worker failed to load".
 *
 * Importing the worker with `?url` makes Vite serve/emit it, and setWorkerUrl()
 * points MapLibre at that URL. Import this module before any map is created.
 */
setWorkerUrl(workerUrl);
