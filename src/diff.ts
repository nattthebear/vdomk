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
} from "./vdom";

function position(child: Node) {
	const parent: Element = child.parentElement!;
	let at = 0;
	for (let node = child.previousSibling; node; node = node.previousSibling) {
		at++;
	}
	return { parent, at };
}

abstract class RNodeBase {
	abstract vNode: VNode;
	abstract element: Node;
	abstract update(vNode: VNode, layer: ComponentLayer): boolean;
	abstract unmount(): void;
	position() {
		const { element } = this;
		const parent: Element = element.parentElement!;
		let at = 0;
		for (let node = element.previousSibling; node; node = node.previousSibling) {
			at++;
		}
		return { parent, at };
	}
}
const EMPTY_PROP_OBJECT: any = {};
export class RElement extends RNodeBase {
	children: RNode;
	element: Element;
	constructor(public vNode: VElement, parent: Element, at: number, layer: ComponentLayer) {
		super();
		const element = document.createElement(vNode.type);
		parent.insertBefore(element, parent.childNodes[at] ?? null);
		this.element = element;
		this.children = mount(vNode.children, element, 0, layer);
		for (const k in vNode.props) {
			setProperty(element, k, undefined, vNode.props[k]);
		}
	}
	unmount() {
		this.children.unmount();
		this.element.remove();
	}
	update(vNode: VNode, layer: ComponentLayer) {
		if (!isVElement(vNode) || this.vNode.type !== vNode.type) {
			return false;
		}
		const oldProps = this.vNode.props ?? EMPTY_PROP_OBJECT;
		const newProps = vNode.props ?? EMPTY_PROP_OBJECT;
		const { element } = this;
		for (const k in oldProps) {
			if (!Object.prototype.hasOwnProperty.call(newProps, k)) {
				setProperty(element, k, oldProps[k], undefined);
			}
		}
		for (const k in newProps) {
			setProperty(element, k, oldProps[k], newProps[k]);
		}
		this.vNode = vNode;
		this.children = diff(this.children, this.vNode.children, layer);
		return true;
	}
}
export class RComponent<P extends Record<string, any>> extends RNodeBase {
	layer: ComponentLayer<P>;
	element = new Text();
	constructor(public vNode: VComponent<P>, parent: Element, at: number, parentLayer: ComponentLayer | undefined) {
		super();
		parent.insertBefore(this.element, parent.childNodes[at] ?? null);
		this.layer = new ComponentLayer(
			new RNothing(undefined, parent, at + 1),
			parentLayer,
			vNode.type,
			() => this.vNode.props
		);
		this.layer.runUpdate();
	}
	unmount() {
		this.layer.unmount();
		this.element.remove();
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
	constructor(public vNode: VArray, parent: Element, at: number, layer: ComponentLayer) {
		super();
		parent.insertBefore(this.end, parent.childNodes[at] ?? null);
		parent.insertBefore(this.element, this.end);
		const offset = parent.childNodes.length - at - 1;
		this.children = vNode.map((v) => mount(v, parent, parent.childNodes.length - offset, layer));
	}
	unmount() {
		for (const child of this.children) {
			child.unmount();
		}
		this.end.remove();
		this.element.remove();
	}
	update(vNode: VNode, layer: ComponentLayer) {
		if (!isVArray(vNode)) {
			return false;
		}
		const oldVNode = this.vNode;
		let i = 0;
		for (; i < vNode.length && i < oldVNode.length; i++) {
			this.children[i] = diff(this.children[i], vNode[i], layer);
		}
		for (; i < oldVNode.length; i++) {
			this.children[i].unmount();
		}
		this.children.length = vNode.length;
		if (i < vNode.length) {
			const { parent, at } = this.position();
			const offset = parent.childNodes.length - at - 1;
			for (; i < vNode.length; i++) {
				this.children[i] = mount(vNode[i], parent, parent.childNodes.length - offset, layer);
			}
		}
		this.vNode = vNode;
		return true;
	}
}
export class RText extends RNodeBase {
	element: Text;
	constructor(public vNode: VText, parent: Element, at: number) {
		super();
		const element = new Text(String(vNode));
		parent.insertBefore(element, parent.childNodes[at] ?? null);
		this.element = element;
	}
	unmount() {
		this.element.remove();
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
	constructor(public vNode: VNothing, parent: Element, at: number) {
		super();
		parent.insertBefore(this.element, parent.childNodes[at] ?? null);
	}
	unmount() {
		this.element.remove();
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

function mount(vNode: VNode, parent: Element, at: number, layer: ComponentLayer): RNode {
	if (isVElement(vNode)) {
		return new RElement(vNode, parent, at, layer);
	}
	if (isVComponent(vNode)) {
		return new RComponent(vNode, parent, at, layer);
	}
	if (isVArray(vNode)) {
		return new RArray(vNode, parent, at, layer);
	}
	if (isVText(vNode)) {
		return new RText(vNode, parent, at);
	}
	return new RNothing(vNode, parent, at);
}

export function diff(r: RNode, newVNode: VNode, layer: ComponentLayer) {
	if (r.vNode === newVNode) {
		return r;
	}
	if (r.update(newVNode, layer)) {
		return r;
	}
	const { parent, at } = r.position();
	r.unmount();
	return mount(newVNode, parent, at, layer);
}

export function createRoot(container: Element) {
	container.textContent = "";
	let vNode: VNode = undefined;
	function RootComponent() {
		return vNode;
	}
	const layer = new ComponentLayer(
		new RNothing(undefined, container, 0),
		undefined,
		RootComponent,
		() => null as any
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
