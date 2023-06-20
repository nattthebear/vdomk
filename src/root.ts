import { RText, RNode, SVG_NS, diff } from "./diff";
import { VNode } from "./vdom";

export interface RenderRoot {
	/** Render new content in the root, diffing with existing content and unmounting/mounting new components as needed. */
	render(newVNode: VNode): void;
	/** Unmount this root entirely, unmounting all child components and removing all nodes.  It can no longer be used. */
	unmount(): void;
}

/**
 * Create a root to render VDom nodes in.
 * @param container the Element to render in
 * @param adjacent if passed, a direct child of container that the root will be inserted before.
 * @returns
 */
export function createRoot(container: Element, adjacent?: Node | null | undefined): RenderRoot {
	const inSvg = container.namespaceURI === SVG_NS && container.tagName !== "foreignObject";
	let rNode: RNode = new RText(undefined, container, adjacent ?? null);

	return {
		render(newVNode) {
			rNode = diff(rNode, newVNode, undefined, inSvg);
		},
		unmount() {
			rNode.unmount(true);
		},
	};
}
