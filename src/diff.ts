import { ComponentLayer } from "./Component";
import { setProperty } from "./props";
import {
	VNode,
	VElement,
	VComponent,
	VArray,
	VText,
	VNothing,
	isVElement,
	isVArray,
	isVText,
	isVNothing,
	isVComponent,
	KeyType,
	getVKey,
} from "./vdom";

export const SVG_NS = "http://www.w3.org/2000/svg";
const EMPTY_PROP_OBJECT: any = {};
const { max, min } = Math;

abstract class RNodeBase {
	abstract vNode: VNode;
	abstract element: ChildNode;
	end: ChildNode | undefined;
	abstract update(vNode: VNode, layer: ComponentLayer): boolean;
	unmount(removeSelf: boolean) {
		if (removeSelf) {
			this.element.remove();
		}
	}
	moveTo(adjacent: Node | null) {
		const parent = this.element.parentElement!;
		const { element, end } = this;
		if (!end) {
			element.remove();
			parent.insertBefore(element, adjacent);
		} else {
			for (let curr: ChildNode = element; ; ) {
				const next = curr.nextSibling;
				curr.remove();
				parent.insertBefore(curr, adjacent);
				if (curr === end) {
					break;
				}
				curr = next!;
			}
		}
	}
}

export class RElement extends RNodeBase {
	children: RNode;
	element: Element;
	selfInSvg: boolean;
	childrenInSvg: boolean;
	constructor(public vNode: VElement, parent: Element, adjacent: Node | null, layer: ComponentLayer, inSvg: boolean) {
		super();
		const { type } = vNode;
		inSvg ||= type === "svg";
		const element = inSvg ? document.createElementNS(SVG_NS, type) : document.createElement(type);
		this.selfInSvg = inSvg;
		inSvg &&= type !== "foreignObject";
		this.childrenInSvg = inSvg;
		parent.insertBefore(element, adjacent);
		this.element = element;
		this.children = mount(vNode.props.children, element, null, layer, inSvg);
		for (const k in vNode.props) {
			setProperty(element, k, undefined, vNode.props[k], this.selfInSvg);
		}
	}
	unmount(removeSelf: boolean) {
		this.children.unmount(true);
		// Most props don't need to be unset when unmounting
		this.vNode.props.ref?.(null);
		super.unmount(removeSelf);
	}
	update(vNode: VNode, layer: ComponentLayer) {
		if (!isVElement(vNode) || this.vNode.type !== vNode.type) {
			return false;
		}
		const oldProps = this.vNode.props ?? EMPTY_PROP_OBJECT;
		const newProps = vNode.props ?? EMPTY_PROP_OBJECT;
		const { element, selfInSvg, childrenInSvg } = this;
		for (const k in oldProps) {
			if (!Object.prototype.hasOwnProperty.call(newProps, k)) {
				setProperty(element, k, oldProps[k], undefined, selfInSvg);
			}
		}
		for (const k in newProps) {
			setProperty(element, k, oldProps[k], newProps[k], selfInSvg);
		}
		this.vNode = vNode;
		this.children = diff(this.children, vNode.props.children, layer, childrenInSvg);
		return true;
	}
}
export class RComponent<P extends Record<string, any>> extends RNodeBase {
	layer: ComponentLayer<P>;
	element = new Text();
	end = new Text();
	constructor(
		public vNode: VComponent<P>,
		parent: Element,
		adjacent: Node | null,
		parentLayer: ComponentLayer | undefined,
		inSvg: boolean
	) {
		super();
		parent.insertBefore(this.element, adjacent);
		this.layer = new ComponentLayer(
			new RNothing(undefined, parent, adjacent),
			parentLayer,
			vNode.type,
			() => this.vNode.props,
			inSvg
		);
		parent.insertBefore(this.end, adjacent);
	}
	unmount(removeSelf: boolean) {
		this.layer.unmount();
		super.unmount(removeSelf);
	}
	update(vNode: VNode) {
		if (!isVComponent(vNode) || this.vNode.type !== vNode.type) {
			return false;
		}
		this.layer.scheduleUpdate();
		this.vNode = vNode;
		return true;
	}
}
export class RArray extends RNodeBase {
	children: RNode[];
	element = new Text();
	end = new Text();
	constructor(
		public vNode: VArray,
		parent: Element,
		adjacent: Node | null,
		layer: ComponentLayer,
		public inSvg: boolean
	) {
		super();
		parent.insertBefore(this.element, adjacent);
		this.children = vNode.map((v) => mount(v, parent, adjacent, layer, inSvg));
		parent.insertBefore(this.end, adjacent);
	}
	unmount(removeSelf: boolean) {
		for (const child of this.children) {
			child.unmount(true);
		}
		super.unmount(removeSelf);
	}
	update(vNode: VNode, layer: ComponentLayer) {
		if (!isVArray(vNode)) {
			return false;
		}
		const { inSvg, children } = this;
		const oldVNode = this.vNode;
		const parent = this.element.parentElement!;

		interface NeedsNew {
			adjacent: ChildNode;
			key: KeyType;
			vNode: VNode;
			index: number;
		}

		let unsatisfied: NeedsNew[] | undefined;
		let reusable: Map<KeyType, RNode> | undefined;
		const oldLength = oldVNode.length;
		const newLength = vNode.length;
		const minLength = min(oldLength, newLength);

		function handleNew(adjacent: ChildNode, key: KeyType, vNode: VNode, index: number, shouldPush: boolean) {
			if (key !== undefined) {
				const toMove = reusable?.get(key);
				if (toMove) {
					reusable!.delete(key);
					toMove.moveTo(adjacent);
					children[index] = diff(toMove, vNode, layer, inSvg);
					return;
				}
				if (shouldPush) {
					const savedAdjacent = new Text();
					parent.insertBefore(savedAdjacent, adjacent);
					(unsatisfied ??= []).push({ adjacent: savedAdjacent, key, vNode, index });
					return;
				}
			}
			children[index] = mount(vNode, parent, adjacent, layer, inSvg);
		}
		function handleOld(rNode: RNode, key: KeyType) {
			if (key !== undefined) {
				(reusable ??= new Map<KeyType, RNode>()).set(key, rNode);
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
				children[i] = diff(rNode, newVChild, layer, inSvg);
			} else {
				handleNew(rNode.element, newKey, newVChild, i, true);
				handleOld(rNode, oldKey);
			}
		}
		for (; i < oldLength; i++) {
			const rNode = children[i];
			const oldVChild = this.vNode[i];
			const oldKey = getVKey(oldVChild);
			handleOld(rNode, oldKey);
		}
		children.length = newLength;
		for (; i < newLength; i++) {
			const newVChild = vNode[i];
			const newKey = getVKey(newVChild);
			handleNew(this.end, newKey, newVChild, i, false);
		}

		if (unsatisfied) {
			for (const { adjacent, key, vNode, index } of unsatisfied) {
				handleNew(adjacent, key, vNode, index, false);
				adjacent.remove();
			}
		}

		if (reusable) {
			for (const rNode of reusable.values()) {
				rNode.unmount(true);
			}
		}

		this.vNode = vNode;
		return true;
	}
}
export class RText extends RNodeBase {
	element: Text;
	constructor(public vNode: VText, parent: Element, adjacent: Node | null) {
		super();
		const element = new Text(String(vNode));
		parent.insertBefore(element, adjacent);
		this.element = element;
	}
	update(vNode: VNode) {
		if (!isVText(vNode)) {
			return false;
		}
		const oldElement = this.element;
		const element = new Text(String(vNode));
		oldElement.parentElement!.insertBefore(element, oldElement);
		oldElement.remove();
		this.vNode = vNode;
		this.element = element;
		return true;
	}
}
export class RNothing extends RNodeBase {
	element = new Text();
	constructor(public vNode: VNothing, parent: Element, adjacent: Node | null) {
		super();
		parent.insertBefore(this.element, adjacent);
	}
	update(vNode: VNode) {
		if (!isVNothing(vNode)) {
			return false;
		}
		this.vNode = vNode;
		return true;
	}
}
export type RNode = RElement | RComponent<any> | RArray | RText | RNothing;

function mount(vNode: VNode, parent: Element, adjacent: Node | null, layer: ComponentLayer, inSvg: boolean): RNode {
	if (isVElement(vNode)) {
		return new RElement(vNode, parent, adjacent, layer, inSvg);
	}
	if (isVComponent(vNode)) {
		return new RComponent(vNode, parent, adjacent, layer, inSvg);
	}
	if (isVArray(vNode)) {
		return new RArray(vNode, parent, adjacent, layer, inSvg);
	}
	if (isVText(vNode)) {
		return new RText(vNode, parent, adjacent);
	}
	return new RNothing(vNode, parent, adjacent);
}

export function diff(r: RNode, newVNode: VNode, layer: ComponentLayer, inSvg: boolean) {
	if (r.vNode === newVNode) {
		return r;
	}
	if (r.update(newVNode, layer)) {
		return r;
	}
	r.unmount(false);
	const ret = mount(newVNode, r.element.parentElement!, r.element, layer, inSvg);
	r.element.remove();
	return ret;
}
