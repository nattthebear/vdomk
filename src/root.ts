import { ComponentLayer, OPC } from "./Component";
import type { VNode } from "./vdom";
import { RText, RNode, SVG_NS, diff } from "./diff";

export interface RenderRoot {
	/** Render new content in the root, diffing with existing content and unmounting/mounting new components as needed. */
	render(newVNode: VNode): void;
	/** Unmount this root entirely, unmounting all child components and removing all nodes.  It can no longer be used. */
	unmount(): void;
}

export interface RootComponentFunctions {
	/** Schedules a layer for update */
	enqueueLayer(layer: ComponentLayer): void;
	/** Schedules a layer for update */
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
 * @returns
 */
export function createRoot(container: Element, adjacent?: Node | null | undefined): RenderRoot {
	let pendingLayers: ComponentLayer[] = [];
	let unmounted = false;
	let flushedRecently = false;
	const endFlushedRecently = triggerLast(() => (flushedRecently = false));
	const scheduleFlush = triggerLast(flush);
	let pendingEffects: (() => void)[] | undefined;

	function flush() {
		if (unmounted || !pendingLayers.length) {
			return;
		}
		flushedRecently = true;
		endFlushedRecently(deferTask);

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
		() => ({ children: vNode }),
		container.namespaceURI === SVG_NS && container.tagName !== "foreignObject"
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
