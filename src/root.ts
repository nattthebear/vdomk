import type { OPC, RenderRoot, VNode, ComponentLayer } from "./types";
import { RComponent, RText } from "./diff";
import { h } from "./createElement";

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

const RootComponent: OPC<{ rootNode: () => VNode }> = ({ rootNode }) => rootNode();

/**
 * Create a root to render VDom nodes in.
 * @param container the Element to render in
 * @param adjacent if passed, a direct child of container that the root will be inserted before.
 * @returns The new root.
 */
export function createRoot(container: Element, adjacent?: Node | null | undefined): RenderRoot {
	let pendingLayers: RComponent<any>[] = [];
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
			layer.runLayerUpdate(false);
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

	function enqueueLayer(layer: RComponent<any>) {
		pendingLayers.push(layer);
		scheduleFlush(flushedRecently ? deferMicrotask : deferTask);
	}
	function enqueueEffect(effect: () => void) {
		pendingEffects?.push(effect) ?? effect();
	}

	const dummyTopTopLayer: ComponentLayer = {
		parentLayer: undefined,
		root: { enqueueLayer, enqueueEffect },
		depth: -1,
	};

	let vNode: VNode;
	const topLayer = new RComponent(
		h(RootComponent, { rootNode: () => vNode }),
		container,
		adjacent ?? null,
		dummyTopTopLayer
	);

	return {
		render(newVNode) {
			vNode = newVNode;
			topLayer.scheduleLayerUpdate();
			flush();
		},
		unmount() {
			unmounted = true;
			topLayer.unmount(true);
		},
	};
}
