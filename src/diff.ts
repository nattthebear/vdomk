import { setControlledInputProps, setProperty } from "./props";
import { enqueueLayer } from "./root";
import type { VNode, VElement, VComponent, VArray, VText, KeyType, OPC, LayerInstance } from "./types";
import { isVElement, isVArray, isVText, isVComponent, getVKey } from "./vdom";

const SVG_NS = "http://www.w3.org/2000/svg";
const { min, max } = Math;
/** Factory to instantiate an RNode type */
export interface RNodeFactory<T extends VNode> {
	/** Validate that the VNode is of the right type for this factory */
	guard(vNode: VNode): vNode is T;
	/** Create the RNode */
	new (vNode: T, parent: Element, adjacent: Node | null, layer: RComponent): RNode & RNodeBase<T>;
}
/** Tracks a VNode that's currently rendered into the document */
export abstract class RNodeBase<T extends VNode> {
	/** The VNode currently rendered by this RNode */
	abstract vNode: VNode;
	/** The DOM node that represents the start of content for this VNode */
	abstract start(): ChildNode;
	/** The DOM node that represents the end of content for this VNode.  Might be equal to start() */
	abstract end(): ChildNode;
	/** Runs pre-removal effects such as unref and component lifecycles. */
	cleanup() {}
	/**
	 * Attempts to update in place.
	 * @param vNode A replacement VNode.
	 * @param layer The component layer this RNode is in.
	 * @returns false if the update could not be performed.
	 */
	abstract update(vNode: T, layer: RComponent): boolean;
	/** Removes all nodes from the DOM.  Should be called after `cleanup()` */
	remove() {
		const range = new Range();
		range.setStartBefore(this.start());
		range.setEndAfter(this.end());
		return range.extractContents();
	}
	/** Calls cleanup followed by remove */
	unmount() {
		this.cleanup();
		this.remove();
	}
	/**
	 * Relocates this RNode in the DOM.  Must keep the same element parent.  Does not fire any lifecycle methods.
	 * @param adjacent Reference Node to place this RNode before.  If null, this is placed at the end of it's parent.
	 */
	moveTo(adjacent: Node | null) {
		const parent = this.start().parentElement!;
		parent.insertBefore(this.remove(), adjacent);
	}
}
/** RNode representing a VElement */
export class RElement extends RNodeBase<VElement> {
	static guard = isVElement;
	children: RNode | undefined;
	element: Element;
	svg: boolean;
	start() {
		return this.element;
	}
	end() {
		return this.element;
	}
	constructor(public vNode: VElement, parent: Element, adjacent: Node | null, layer: RComponent) {
		super();
		const { type } = vNode;
		const svg = type === "svg" || (parent.namespaceURI === SVG_NS && parent.tagName !== "foreignObject");
		const element = svg ? document.createElementNS(SVG_NS, type) : document.createElement(type);
		this.svg = svg;
		this.element = element;
		const { props } = vNode;
		for (const k in props) {
			setProperty(element, k, undefined, (props as any)[k], this.svg, layer.depth + 1);
		}
		const { children } = props;
		if (children !== undefined) {
			this.children = mount(children, element, null, layer);
		}
		setControlledInputProps(element, "value", props);
		setControlledInputProps(element, "checked", props);
		parent.insertBefore(element, adjacent);
	}
	cleanup() {
		this.children?.cleanup();
		// Most props don't need to be unset when unmounting
		this.vNode.props.ref?.(null);
	}
	update(vNode: VElement, layer: RComponent) {
		if (this.vNode.type !== vNode.type) {
			return false;
		}
		const oldProps = this.vNode.props;
		const newProps = vNode.props;
		const { element, svg } = this;
		const depth = layer.depth + 1;
		for (const k in oldProps) {
			if (!(k in newProps)) {
				setProperty(element, k, (oldProps as any)[k], undefined, svg, depth);
			}
		}
		for (const k in newProps) {
			setProperty(element, k, (oldProps as any)[k], (newProps as any)[k], svg, depth);
		}
		this.vNode = vNode;
		const { children } = newProps;
		if (this.children && children !== undefined) {
			this.children = diff(this.children, children, layer);
		} else if (this.children) {
			this.children.unmount();
			this.children = undefined;
		} else if (children !== undefined) {
			this.children = mount(children, element, null, layer);
		}
		setControlledInputProps(element, "value", newProps);
		setControlledInputProps(element, "checked", newProps);
		return true;
	}
}
/** RNode representing a VComponent */
export class RComponent<P extends Record<string, any> = any> extends RNodeBase<VComponent> implements RComponent {
	static guard = isVComponent;
	parentLayer: RComponent | undefined;
	layerRNode: RNode;
	depth: number;
	alive = true;
	pending = true;
	cleanupQueue: (() => void)[] | undefined;
	opc: OPC<P>;
	context: unknown | undefined;
	start(): ChildNode {
		return this.layerRNode.start();
	}
	end(): ChildNode {
		return this.layerRNode.end();
	}
	constructor(
		public vNode: VComponent<P>,
		parent: Element,
		adjacent: Node | null,
		parentLayer: RComponent | undefined
	) {
		super();
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

	cleanup() {
		this.alive = false;
		const { cleanupQueue } = this;
		if (cleanupQueue) {
			for (let i = cleanupQueue.length - 1; i >= 0; i--) {
				(0, cleanupQueue[i])();
			}
		}
		this.layerRNode.cleanup();
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
	static guard = isVArray;
	children: RNode[] = [];
	start(): ChildNode {
		return this.children[0].start();
	}
	end(): ChildNode {
		return this.children.at(-1)!.end();
	}
	constructor(public vNode: VArray, parent: Element, adjacent: Node | null, layer: RComponent) {
		super();
		const { children } = this;
		// Always put at least one undefined in the RNode array
		const len = max(vNode.length, 1);
		for (let i = 0; i < len; i++) {
			children[i] = mount(vNode[i], parent, adjacent, layer);
		}
	}
	cleanup() {
		for (const child of this.children) {
			child.cleanup();
		}
	}
	update(vNode: VArray, layer: RComponent) {
		const { children } = this;
		const oldVNode = this.vNode;
		let parent: Element;
		let end: ChildNode | null;
		{
			const temp = this.end();
			parent = temp.parentElement!;
			end = temp.nextSibling;
		}

		interface ToBeMounted {
			adjacent: ChildNode;
			key: KeyType;
			vNode: VNode;
			index: number;
		}

		let toBeMounted: ToBeMounted[] | undefined;
		let toBeUnmounted: Map<KeyType, RNode> | undefined;
		const oldLength = oldVNode.length;
		let newLength = vNode.length;
		let minLength = min(oldLength, newLength);
		// Always put at least one undefined in the RNode array
		minLength = max(minLength, 1);
		newLength = max(newLength, 1);

		function tryMount(adjacent: ChildNode | null, key: KeyType, vNode: VNode, index: number, canDefer: boolean) {
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
				rNode.unmount();
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
				tryMount(rNode.start(), newKey, newVChild, i, true);
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
			tryMount(end, newKey, newVChild, i, false);
		}

		if (toBeMounted) {
			for (const { adjacent, key, vNode, index } of toBeMounted) {
				tryMount(adjacent, key, vNode, index, false);
				adjacent.remove();
			}
		}

		if (toBeUnmounted) {
			for (const rNode of toBeUnmounted.values()) {
				rNode.unmount();
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
	static guard = isVText;
	text: Text;
	start() {
		return this.text;
	}
	end() {
		return this.text;
	}
	constructor(public vNode: VText, parent: Element, adjacent: Node | null) {
		super();
		const element = new Text(toText(vNode));
		parent.insertBefore(element, adjacent);
		this.text = element;
	}
	update(vNode: VText) {
		this.text.nodeValue = toText(vNode);
		this.vNode = vNode;
		return true;
	}
}

export interface RElement {
	constructor: typeof RElement & RNodeFactory<VElement>;
}
export interface RComponent<P extends Record<string, any> = any> {
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
	component: RComponent;
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
export function mount(vNode: VNode, parent: Element, adjacent: Node | null, layer: RComponent): RNode {
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
export function diff(r: RNode, newVNode: VNode, layer: RComponent) {
	const oldVNode = r.vNode;
	if (oldVNode === newVNode) {
		return r;
	}
	if (r.constructor.guard(newVNode) && getVKey(oldVNode) === getVKey(newVNode) && r.update(newVNode as any, layer)) {
		return r;
	}
	r.cleanup();
	const start = r.start();
	const ret = mount(newVNode, start.parentElement!, start, layer);
	r.remove();
	return ret;
}
