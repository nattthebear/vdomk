import type { AssertTrue, Has } from "conditional-type-checks";
import { ComponentLayer } from "./Component";
import { setProperty } from "./props";
import {
	VNode,
	VElement,
	VComponent,
	VArray,
	VText,
	isVElement,
	isVArray,
	isVText,
	isVComponent,
	KeyType,
	getVKey,
} from "./vdom";

export const SVG_NS = "http://www.w3.org/2000/svg";
const { min } = Math;

interface RNodeFactory<T extends VNode> {
	guard(vNode: VNode): vNode is T;
	new (vNode: T, parent: Element, adjacent: Node | null, layer: ComponentLayer): RNode & RNodeBase<T>;
}

abstract class RNodeBase<T extends VNode> {
	abstract vNode: VNode;
	abstract element: ChildNode;
	end: ChildNode | undefined;
	abstract update(vNode: T, layer: ComponentLayer): boolean;
	unmount(removeSelf: boolean) {
		if (removeSelf) {
			this.element.remove();
		}
	}
	moveTo(adjacent: Node | null) {
		const { element, end } = this;
		const parent = element.parentElement!;
		const range = new Range();
		range.setStartBefore(element);
		range.setEndAfter(end ?? element);
		parent.insertBefore(range.extractContents(), adjacent);
	}
}
type __CHECKRElement = AssertTrue<Has<typeof RElement, RNodeFactory<VElement>>>;
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
			setProperty(element, k, undefined, props[k], this.svg);
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
				setProperty(element, k, oldProps[k], undefined, svg);
			}
		}
		for (const k in newProps) {
			setProperty(element, k, oldProps[k], newProps[k], svg);
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
type __CHECKRComponent = AssertTrue<Has<typeof RComponent, RNodeFactory<VComponent>>>;
export class RComponent<P extends Record<string, any>> extends RNodeBase<VComponent> {
	layer: ComponentLayer<P>;
	element = new Text();
	end = new Text();
	static guard = isVComponent;
	constructor(public vNode: VComponent<P>, parent: Element, adjacent: Node | null, parentLayer: ComponentLayer) {
		super();
		parent.insertBefore(this.element, adjacent);
		this.layer = new ComponentLayer(
			new RText(undefined, parent, adjacent),
			parentLayer,
			parentLayer.root,
			vNode.type,
			() => this.vNode.props
		);
		parent.insertBefore(this.end, adjacent);
	}
	unmount(removeSelf: boolean) {
		this.layer.unmount();
		super.unmount(removeSelf);
	}
	update(vNode: VComponent) {
		if (this.vNode.type !== vNode.type) {
			return false;
		}
		const oldProps = this.vNode.props;
		this.vNode = vNode;
		if (oldProps !== vNode.props) {
			this.layer.runUpdate(true);
		}
		return true;
	}
}
type __CHECKRArray = AssertTrue<Has<typeof RArray, RNodeFactory<VArray>>>;
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
function toText(vNode: VText) {
	if (vNode == null || typeof vNode === "boolean") {
		return "";
	}
	return String(vNode);
}
type __CHECKRText = AssertTrue<Has<typeof RText, RNodeFactory<VText>>>;
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
export type RNode = RElement | RComponent<any> | RArray | RText;

const factories: RNodeFactory<any>[] = [RElement, RComponent, RArray, RText];

function mount(vNode: VNode, parent: Element, adjacent: Node | null, layer: ComponentLayer): RNode {
	for (const clazz of factories) {
		if (clazz.guard(vNode)) {
			return new clazz(vNode, parent, adjacent, layer);
		}
	}
	// This can only be hit by violating the types
	return undefined!;
}

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
