import { ComponentLayer } from "./Component";
import { setProperty } from "./props";
import { VNode, VElement, VComponent, VArray, VText, isVElement, isVArray, isVText, isVComponent } from "./vdom";

export const SVG_NS = "http://www.w3.org/2000/svg";

abstract class RNodeBase {
	abstract vNode: VNode;
	abstract element: ChildNode;
	abstract update(vNode: VNode, layer: ComponentLayer): boolean;
	unmount(removeSelf: boolean) {
		if (removeSelf) {
			this.element.remove();
		}
	}
}
export class RElement extends RNodeBase {
	children: RNode | undefined;
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
		const { props } = vNode;
		for (const k in props) {
			setProperty(element, k, undefined, props[k], this.selfInSvg);
		}
		const { children } = props;
		if (children !== undefined) {
			this.children = mount(children, element, null, layer, inSvg);
		}
	}
	unmount(removeSelf: boolean) {
		this.children?.unmount(true);
		super.unmount(removeSelf);
	}
	update(vNode: VNode, layer: ComponentLayer) {
		if (!isVElement(vNode) || this.vNode.type !== vNode.type) {
			return false;
		}
		const oldProps = this.vNode.props;
		const newProps = vNode.props;
		const { element, selfInSvg, childrenInSvg } = this;
		for (const k in oldProps) {
			if (!(k in newProps)) {
				setProperty(element, k, oldProps[k], undefined, selfInSvg);
			}
		}
		for (const k in newProps) {
			setProperty(element, k, oldProps[k], newProps[k], selfInSvg);
		}
		this.vNode = vNode;
		const { children } = newProps;
		if (this.children && children !== undefined) {
			this.children = diff(this.children, children, layer, childrenInSvg);
		} else if (this.children) {
			this.children.unmount(true);
			this.children = undefined;
		} else if (children !== undefined) {
			this.children = mount(children, element, null, layer, childrenInSvg);
		}
		return true;
	}
}
export class RComponent<P extends Record<string, any>> extends RNodeBase {
	layer: ComponentLayer<P>;
	element = new Text();
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
			new RText(undefined, parent, adjacent),
			parentLayer,
			vNode.type,
			() => this.vNode.props,
			inSvg
		);
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
		this.end.remove();
		super.unmount(removeSelf);
	}
	update(vNode: VNode, layer: ComponentLayer) {
		if (!isVArray(vNode)) {
			return false;
		}
		const { inSvg } = this;
		const oldVNode = this.vNode;
		let i = 0;
		for (; i < vNode.length && i < oldVNode.length; i++) {
			this.children[i] = diff(this.children[i], vNode[i], layer, inSvg);
		}
		for (; i < oldVNode.length; i++) {
			this.children[i].unmount(true);
		}
		this.children.length = vNode.length;
		if (i < vNode.length) {
			const { end } = this;
			const parent = end.parentElement!;
			for (; i < vNode.length; i++) {
				this.children[i] = mount(vNode[i], parent, end, layer, inSvg);
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
export class RText extends RNodeBase {
	element: Text;
	constructor(public vNode: VText, parent: Element, adjacent: Node | null) {
		super();
		const element = new Text(toText(vNode));
		parent.insertBefore(element, adjacent);
		this.element = element;
	}
	update(vNode: VNode) {
		if (!isVText(vNode)) {
			return false;
		}
		this.element.nodeValue = toText(vNode);
		this.vNode = vNode;
		return true;
	}
}
export type RNode = RElement | RComponent<any> | RArray | RText;

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
	return new RText(vNode, parent, adjacent);
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
