import { enqueueEffect } from "./root";
import type { LayerInstance } from "./types";
import type { RComponent } from "./diff";

/** Registers a function to be called when this component is unmounted. */
export function cleanup(instance: LayerInstance, cb: () => void) {
	if ((instance as any as RComponent<any>).alive) {
		((instance as any as RComponent<any>).cleanupQueue ??= []).push(cb);
	} else {
		cb();
	}
}
/** Calls a function in the effect phase after this render completes. */
export function effect(instance: LayerInstance, cb: () => void) {
	enqueueEffect(instance as any as RComponent<any>, cb);
}
/** Schedules a rerender of this component. */
export function scheduleUpdate(instance: LayerInstance) {
	(instance as any as RComponent<any>).scheduleLayerUpdate();
}
