import type { OPC, RenderRoot, VNode, ComponentLayer } from "./types";
import { RComponent, RText } from "./diff";
import { h } from "./createElement";

function compareLayers(x: ComponentLayer, y: ComponentLayer) {
	return x.depth - y.depth;
}

const RootComponent: OPC<{ rootNode: () => VNode }> = ({ rootNode }) => rootNode();

/**
 * Create a root to render VDom nodes in.
 * @param container the Element to render in
 * @param vNode the initial content to render.
 * @param adjacent if passed, a direct child of container that the root will be inserted before.
 *   If not present, the root will be placed at the end of the container.
 * @returns The new root.
 */
export function createRoot(container: Element, vNode: VNode, adjacent?: Node | null | undefined): RenderRoot {
	let pendingLayers: RComponent<any>[] = [];
	let unmounted = false;
	let pendingEffects: (() => void)[] | undefined;

	function flush() {
		while (!unmounted && pendingLayers.length) {
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

	async function enqueueLayer(layer: RComponent<any>) {
		pendingLayers.push(layer);
		await 0;
		flush();
	}
	function enqueueEffect(effect: () => void) {
		pendingEffects?.push(effect) ?? effect();
	}

	const dummyTopTopLayer: ComponentLayer = {
		parentLayer: undefined,
		root: { enqueueLayer, enqueueEffect },
		depth: -1,
	};

	const topLayer = new RComponent(
		h(RootComponent, { rootNode: () => vNode }),
		container,
		adjacent ?? null,
		dummyTopTopLayer
	);

	return {
		async render(newVNode) {
			vNode = newVNode;
			topLayer.scheduleLayerUpdate();
			await 0;
			flush();
		},
		unmount() {
			unmounted = true;
			topLayer.unmount(true);
		},
	};
}
