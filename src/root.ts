import { ComponentLayer } from "./Component";
import { RText, SVG_NS } from "./diff";
import { VNode } from "./vdom";

export function createRoot(container: Element) {
	container.textContent = "";
	let vNode: VNode = undefined;
	function RootComponent() {
		return vNode;
	}
	const layer = new ComponentLayer(
		new RText(undefined, container, null),
		undefined,
		RootComponent,
		() => null as any,
		container.namespaceURI === SVG_NS
	);

	return {
		render(nextVNode: VNode) {
			vNode = nextVNode;
			layer.runUpdate();
		},
		unmount() {
			layer.unmount();
		},
	};
}
