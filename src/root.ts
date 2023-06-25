import type { OPC, RenderRoot, VNode, ComponentLayer } from "./types";
import { RComponent } from "./diff";

function compareLayers(x: ComponentLayer, y: ComponentLayer) {
	return x.depth - y.depth;
}

let pendingLayers: RComponent<any>[] = [];
let pendingEffects: (() => void)[] | undefined;

function flush() {
	while (pendingLayers.length) {
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
}

const RootComponent: OPC<{ rootNode: () => VNode }> = ({ rootNode }) => rootNode();

/**
 * Create a root to render VDom nodes in.
 * @param container the Element to render in
 * @param initialVNode the initial content to render.
 * @param adjacent if passed, a direct child of container that the root will be inserted before.
 *   If not present, the root will be placed at the end of the container.
 * @returns The new root.
 */
export function createRoot(container: Element, initialVNode: VNode, adjacent?: Node | null | undefined): RenderRoot {
	let vNode: VNode;
	const topLayer = new RComponent(
		{ type: RootComponent, key: undefined, props: { rootNode: () => vNode } },
		container,
		adjacent ?? null,
		undefined
	);
	vNode = initialVNode;
	topLayer.scheduleLayerUpdate();
	flush();

	return {
		async render(newVNode) {
			vNode = newVNode;
			topLayer.scheduleLayerUpdate();
			await 0;
			flush();
		},
		unmount() {
			topLayer.unmount(true);
		},
	};
}

/** Schedules a layer for update */
export async function enqueueLayer(layer: RComponent<any>) {
	pendingLayers.push(layer);
	await 0;
	flush();
}
/** Schedules an effect to be run after this render cycle completes. */
export function enqueueEffect(effect: () => void) {
	pendingEffects?.push(effect) ?? effect();
}
