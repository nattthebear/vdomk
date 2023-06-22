import type { OPC, RenderRoot, VNode } from "./types";
import { ComponentLayer } from "./Component";
import { RText } from "./diff";

/** The capabilities provided by the render root to components */
export interface RootComponentFunctions {
	/** Schedules a layer for update */
	enqueueLayer(layer: ComponentLayer): void;
	/** Schedules an effect to be run after this render cycle completes. */
	enqueueEffect(effect: () => void): void;
}

function compareLayers(x: ComponentLayer, y: ComponentLayer) {
	return x.depth - y.depth;
}

type Deferrer = (cb: () => void) => void;
const deferMicrotask: Deferrer = Promise.prototype.then.bind(Promise.resolve());
const deferTask: Deferrer = (cb) => setTimeout(cb, 0);
function triggerLast(cb: () => void) {
	let sequence = 0;
	return (deferrer: Deferrer) => {
		const current = ++sequence;
		deferrer(() => {
			if (current === sequence) {
				cb();
			}
		});
	};
}

const RootComponent: OPC<{ children: VNode }> = ({ children }) => children;

/**
 * Create a root to render VDom nodes in.
 * @param container the Element to render in
 * @param adjacent if passed, a direct child of container that the root will be inserted before.
 * @returns The new root.
 */
export function createRoot(container: Element, adjacent?: Node | null | undefined): RenderRoot {
	let pendingLayers: ComponentLayer[] = [];
	let unmounted = false;
	let flushedRecently = false;
	const scheduleEndFlushedRecently = triggerLast(() => (flushedRecently = false));
	const scheduleFlush = triggerLast(flush);
	let pendingEffects: (() => void)[] | undefined;

	function flush() {
		if (unmounted || !pendingLayers.length) {
			return;
		}
		flushedRecently = true;
		scheduleEndFlushedRecently(deferTask);

		const todoLayers = pendingLayers;
		pendingLayers = [];
		todoLayers.sort(compareLayers);
		pendingEffects = [];
		for (const layer of todoLayers) {
			layer.runUpdate(false);
		}

		while (pendingEffects.length) {
			const todoEffects = pendingEffects;
			pendingEffects = [];
			for (let i = todoEffects.length - 1; i >= 0; i--) {
				todoEffects[i]();
			}
		}

		pendingEffects = undefined;
	}

	function enqueueLayer(layer: ComponentLayer) {
		pendingLayers.push(layer);
		scheduleFlush(flushedRecently ? deferMicrotask : deferTask);
	}
	function enqueueEffect(effect: () => void) {
		pendingEffects?.push(effect) ?? effect();
	}

	let vNode: VNode;
	const topLayer = new ComponentLayer(
		new RText(undefined, container, adjacent ?? null),
		undefined,
		{ enqueueLayer, enqueueEffect },
		RootComponent,
		() => ({ children: vNode })
	);

	return {
		render(newVNode) {
			vNode = newVNode;
			topLayer.scheduleUpdate();
			flush();
		},
		unmount() {
			unmounted = true;
			topLayer.unmount();
		},
	};
}
