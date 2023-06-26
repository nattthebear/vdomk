import { setProperty } from "./props";
import { enqueueLayer } from "./root";
import type { VNode, VElement, VComponent, VArray, VText, KeyType, ComponentLayer, OPC, LayerInstance } from "./types";
import { isVElement, isVArray, isVText, isVComponent, getVKey } from "./vdom";

export const SVG_NS = "http://www.w3.org/2000/svg";
const { min } = Math;
/** Factory to instantiate an RNode type */
export interface RNodeFactory<T extends VNode> {
	/** Validate that the VNode is of the right type for this factory */
	guard(vNode: VNode): vNode is T;
	/** Create the RNode */
	new (vNode: T, parent: Element, adjacent: Node | null, layer: ComponentLayer): RNode & RNodeBase<T>;
}
/** Tracks a VNode that's currently rendered into the document */
export abstract class RNodeBase<T extends VNode> {
	/** The VNode currently rendered by this RNode */
	abstract vNode: VNode;
	/** The DOM Node that represents the start of content for this VNode */
	abstract element: ChildNode;
	/** If present, a marker node that defines the end of content for this VNode.  If not present, this.element is the only rendered Node. */
	end: ChildNode | undefined;
	/**
	 * Attempts to update in place.
	 * @param vNode A replacement VNode.
	 * @param layer The component layer this RNode is in.
	 * @returns false if the update could not be performed.
	 */
	abstract update(vNode: T, layer: ComponentLayer): boolean;
	/**
	 * Fully unmount this RNode.
	 * @param removeSelf If false, the caller will have to call rNode.element.remove() afterwards.
	 */
	unmount(removeSelf: boolean) {
		if (removeSelf) {
			this.element.remove();
		}
	}
	/**
	 * Relocates this RNode in the DOM.  Must keep the same element parent.  Does not fire any lifecycle methods.
	 * @param adjacent Reference Node to place this RNode before.  If null, this is placed at the end of it's parent.
	 */
	moveTo(adjacent: Node | null) {
		const { element, end } = this;
		const parent = element.parentElement!;
		const range = new Range();
		range.setStartBefore(element);
		range.setEndAfter(end ?? element);
		parent.insertBefore(range.extractContents(), adjacent);
	}
}
/** RNode representing a VElement */
export class RElement extends RNodeBase<VElement> {
	children: RNode | undefined;
	element: Element;
	svg: boolean;
	static guard = isVElement;
	constructor(public vNode: VElement, parent: Element, adjacent: Node | null, layer: ComponentLayer) {
		super();
		const { type } = vNode;
		const svg = type === "svg" || (parent.namespaceURI === SVG_NS && parent.tagName !== "foreignObject");
		const element = svg ? document.createElementNS(SVG_NS, type) : document.createElement(type);
		this.svg = svg;
		parent.insertBefore(element, adjacent);
		this.element = element;
		const { props } = vNode;
		for (const k in props) {
			setProperty(element, k, undefined, (props as any)[k], this.svg);
		}
		const { children } = props;
		if (children !== undefined) {
			this.children = mount(children, element, null, layer);
		}
	}
	unmount(removeSelf: boolean) {
		this.children?.unmount(true);
		// Most props don't need to be unset when unmounting
		this.vNode.props.ref?.(null);
		super.unmount(removeSelf);
	}
	update(vNode: VElement, layer: ComponentLayer) {
		if (this.vNode.type !== vNode.type) {
			return false;
		}
		const oldProps = this.vNode.props;
		const newProps = vNode.props;
		const { element, svg } = this;
		for (const k in oldProps) {
			if (!(k in newProps)) {
				setProperty(element, k, (oldProps as any)[k], undefined, svg);
			}
		}
		for (const k in newProps) {
			setProperty(element, k, (oldProps as any)[k], (newProps as any)[k], svg);
		}
		this.vNode = vNode;
		const { children } = newProps;
		if (this.children && children !== undefined) {
			this.children = diff(this.children, children, layer);
		} else if (this.children) {
			this.children.unmount(true);
			this.children = undefined;
		} else if (children !== undefined) {
			this.children = mount(children, element, null, layer);
		}
		return true;
	}
}
/** RNode representing a VComponent */
export class RComponent<P extends Record<string, any>> extends RNodeBase<VComponent> implements ComponentLayer {
	parentLayer: ComponentLayer | undefined;
	layerRNode: RNode;
	depth: number;
	element = new Text();
	end = new Text();
	alive = true;
	pending = true;
	cleanupQueue: (() => void)[] | undefined;
	opc: OPC<P>;
	context: import("./context").ContextData | undefined;
	static guard = isVComponent;
	constructor(
		public vNode: VComponent<P>,
		parent: Element,
		adjacent: Node | null,
		parentLayer: ComponentLayer | undefined
	) {
		super();
		parent.insertBefore(this.element, adjacent);
		this.parentLayer = parentLayer;
		this.depth = (parentLayer?.depth ?? -1) + 1;

		const { type, props } = vNode;
		let newLayerVNode: VNode;
		const res = type(props, this as unknown as LayerInstance);
		if (typeof res === "function") {
			this.opc = res;
			newLayerVNode = res(props, this as unknown as LayerInstance);
		} else {
			this.opc = type as OPC<P>;
			newLayerVNode = res;
		}
		this.layerRNode = new RText(undefined, parent, adjacent);
		this.finishLayerUpdate(newLayerVNode);

		parent.insertBefore(this.end, adjacent);
	}

	runLayerUpdate(force: boolean) {
		if (this.alive && (this.pending || force)) {
			this.finishLayerUpdate((0, this.opc)(this.vNode.props, this as unknown as LayerInstance));
		}
	}
	private finishLayerUpdate(newLayerVNode: VNode) {
		this.pending = false;
		this.layerRNode = diff(this.layerRNode, newLayerVNode, this);
	}
	scheduleLayerUpdate() {
		if (!this.alive || this.pending) {
			return;
		}
		this.pending = true;
		enqueueLayer(this);
	}

	unmount(removeSelf: boolean) {
		this.alive = false;
		const { cleanupQueue } = this;
		if (cleanupQueue) {
			for (let i = cleanupQueue.length - 1; i >= 0; i--) {
				cleanupQueue[i]();
			}
		}
		this.layerRNode.unmount(true);
		super.unmount(removeSelf);
	}
	update(vNode: VComponent) {
		if (this.vNode.type !== vNode.type) {
			return false;
		}
		const oldProps = this.vNode.props;
		this.vNode = vNode;
		if (oldProps !== vNode.props) {
			this.runLayerUpdate(true);
		}
		return true;
	}
}
/** RNode representing a VArray */
export class RArray extends RNodeBase<VArray> {
	children: RNode[];
	element = new Text();
	end = new Text();
	static guard = isVArray;
	constructor(public vNode: VArray, parent: Element, adjacent: Node | null, layer: ComponentLayer) {
		super();
		parent.insertBefore(this.element, adjacent);
		this.children = vNode.map((v) => mount(v, parent, adjacent, layer));
		parent.insertBefore(this.end, adjacent);
	}
	unmount(removeSelf: boolean) {
		for (const child of this.children) {
			child.unmount(true);
		}
		this.end.remove();
		super.unmount(removeSelf);
	}
	update(vNode: VArray, layer: ComponentLayer) {
		const { children } = this;
		const oldVNode = this.vNode;
		const parent = this.element.parentElement!;

		interface ToBeMounted {
			adjacent: ChildNode;
			key: KeyType;
			vNode: VNode;
			index: number;
		}

		let toBeMounted: ToBeMounted[] | undefined;
		let toBeUnmounted: Map<KeyType, RNode> | undefined;
		const oldLength = oldVNode.length;
		const newLength = vNode.length;
		const minLength = min(oldLength, newLength);

		function tryMount(adjacent: ChildNode, key: KeyType, vNode: VNode, index: number, canDefer: boolean) {
			if (key !== undefined) {
				const toMove = toBeUnmounted?.get(key);
				if (toMove) {
					toBeUnmounted!.delete(key);
					toMove.moveTo(adjacent);
					children[index] = diff(toMove, vNode, layer);
					return;
				}
				if (canDefer) {
					const savedAdjacent = new Text();
					parent.insertBefore(savedAdjacent, adjacent);
					(toBeMounted ??= []).push({ adjacent: savedAdjacent, key, vNode, index });
					return;
				}
			}
			children[index] = mount(vNode, parent, adjacent, layer);
		}
		function tryUnmount(rNode: RNode, key: KeyType) {
			if (key !== undefined) {
				(toBeUnmounted ??= new Map<KeyType, RNode>()).set(key, rNode);
			} else {
				rNode.unmount(true);
			}
		}

		let i = 0;
		for (; i < minLength; i++) {
			const rNode = children[i];
			const oldVChild = this.vNode[i];
			const newVChild = vNode[i];
			const oldKey = getVKey(oldVChild);
			const newKey = getVKey(newVChild);

			if (oldKey === newKey) {
				children[i] = diff(rNode, newVChild, layer);
			} else {
				tryMount(rNode.element, newKey, newVChild, i, true);
				tryUnmount(rNode, oldKey);
			}
		}
		for (; i < oldLength; i++) {
			const rNode = children[i];
			const oldVChild = this.vNode[i];
			const oldKey = getVKey(oldVChild);
			tryUnmount(rNode, oldKey);
		}
		children.length = newLength;
		for (; i < newLength; i++) {
			const newVChild = vNode[i];
			const newKey = getVKey(newVChild);
			tryMount(this.end, newKey, newVChild, i, false);
		}

		if (toBeMounted) {
			for (const { adjacent, key, vNode, index } of toBeMounted) {
				tryMount(adjacent, key, vNode, index, false);
				adjacent.remove();
			}
		}

		if (toBeUnmounted) {
			for (const rNode of toBeUnmounted.values()) {
				rNode.unmount(true);
			}
		}

		this.vNode = vNode;
		return true;
	}
}
/** Compute the string display representation of a VText */
function toText(vNode: VText) {
	if (vNode == null || typeof vNode === "boolean") {
		return "";
	}
	return String(vNode);
}
/** RNode representing a VText */
export class RText extends RNodeBase<VText> {
	element: Text;
	static guard = isVText;
	constructor(public vNode: VText, parent: Element, adjacent: Node | null) {
		super();
		const element = new Text(toText(vNode));
		parent.insertBefore(element, adjacent);
		this.element = element;
	}
	update(vNode: VText) {
		this.element.nodeValue = toText(vNode);
		this.vNode = vNode;
		return true;
	}
}

export interface RElement {
	constructor: typeof RElement & RNodeFactory<VElement>;
}
export interface RComponent<P extends Record<string, any>> {
	constructor: typeof RComponent & RNodeFactory<VComponent>;
}
export interface RArray {
	constructor: typeof RArray & RNodeFactory<VArray>;
}
export interface RText {
	constructor: typeof RText & RNodeFactory<VText>;
}
export interface RNodeTypes {
	element: RElement;
	component: RComponent<any>;
	array: RArray;
	text: RText;
}
export type RNode = RNodeTypes[keyof RNodeTypes];

/** List of all RNode creators.  Extend to add a new RNode type. */
export const rNodeFactories: RNodeFactory<any>[] = [
	RElement satisfies RNodeFactory<VElement>,
	RComponent satisfies RNodeFactory<VComponent>,
	RArray satisfies RNodeFactory<VArray>,
	RText satisfies RNodeFactory<VText>,
];

/**
 * Mount a VNode, returning an RNode representing the rendering of it into the DOM.
 * @param vNode The VNode to mount.
 * @param parent The DOM Element to place this VNode in.
 * @param adjacent A child of parent to place this RNode before.  If null, place at the end of parent.
 * @param layer The current component layer.
 * @returns
 */
export function mount(vNode: VNode, parent: Element, adjacent: Node | null, layer: ComponentLayer): RNode {
	for (const clazz of rNodeFactories) {
		if (clazz.guard(vNode)) {
			return new clazz(vNode, parent, adjacent, layer);
		}
	}
	// This can only be hit by violating the types
	return undefined!;
}

/**
 * Execute a diff of VNodes, updating, unmounting, and mounting as needed.
 * @param r The current RNode
 * @param newVNode The replacement VNode.
 * @param layer The current component layer.
 * @returns The new RNode.  May be the same as r if an in-place update was done.
 */
export function diff(r: RNode, newVNode: VNode, layer: ComponentLayer) {
	const oldVNode = r.vNode;
	if (oldVNode === newVNode) {
		return r;
	}
	if (r.constructor.guard(newVNode) && getVKey(oldVNode) === getVKey(newVNode) && r.update(newVNode as any, layer)) {
		return r;
	}
	r.unmount(false);
	const ret = mount(newVNode, r.element.parentElement!, r.element, layer);
	r.element.remove();
	return ret;
}
