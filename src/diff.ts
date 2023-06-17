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
	abstract type: string;
	vNode: VNode;
	abstract unmount(): void;
	abstract position(): { parent: Element; at: number };
}
const EMPTY_PROP_OBJECT: any = {};
export class RElement extends RNodeBase {
	type = "element" as const;
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
	position() {
		return position(this.element);
	}
	unmount() {
		this.children.unmount();
		this.element.remove();
	}
	update(vNode: VElement, layer: ComponentLayer) {
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
	}
}
export class RComponent<P extends Record<string, any>> extends RNodeBase {
	type = "component" as const;
	layer: ComponentLayer<P>;
	start = new Text();
	constructor(public vNode: VComponent<P>, parent: Element, at: number, parentLayer: ComponentLayer | undefined) {
		super();
		parent.insertBefore(this.start, parent.childNodes[at] ?? null);
		this.layer = new ComponentLayer(
			new RNothing(undefined, parent, at + 1),
			parentLayer,
			vNode.type,
			() => this.vNode.props
		);
		this.layer.runUpdate();
	}
	position() {
		return position(this.start);
	}
	unmount() {
		this.layer.unmount();
		this.start.remove();
	}
	update(vNode: VComponent<P>) {
		this.layer.scheduleUpdate();
		this.vNode = vNode;
	}
}

export class RArray extends RNodeBase {
	type = "array" as const;
	children: RNode[];
	start = new Text();
	end = new Text();
	constructor(public vNode: VArray, parent: Element, at: number, layer: ComponentLayer) {
		super();
		parent.insertBefore(this.end, parent.childNodes[at] ?? null);
		parent.insertBefore(this.start, this.end);
		this.children = vNode.map((v, i) => mount(v, parent, at + i + 1, layer));
	}
	position() {
		return position(this.start);
	}
	unmount() {
		for (const child of this.children) {
			child.unmount();
		}
		this.end.remove();
		this.start.remove();
	}
	update(vNode: VArray, layer: ComponentLayer) {
		const oldVNode = this.vNode;
		let i = 0;
		for (; i < vNode.length && i < oldVNode.length; i++) {
			this.children[i] = diff(this.children[i], vNode[i], layer);
		}
		for (; i < oldVNode.length; i++) {
			this.children[i].unmount();
		}
		this.children.length = vNode.length;
		const { parent, at } = this.position();
		for (; i < vNode.length; i++) {
			this.children[i] = mount(vNode[i], parent, at + i + 1, layer);
		}
		this.vNode = vNode;
	}
}
export class RText extends RNodeBase {
	type = "text" as const;
	element: Text;
	constructor(public vNode: VText, parent: Element, at: number) {
		super();
		const element = new Text(String(vNode));
		parent.insertBefore(element, parent.childNodes[at] ?? null);
		this.element = element;
	}
	position() {
		return position(this.element);
	}
	unmount() {
		this.element.remove();
	}
	update(vNode: VText) {
		const oldElement = this.element;
		const element = new Text(String(vNode));
		oldElement.parentElement!.insertBefore(element, oldElement);
		oldElement.remove();
		this.vNode = vNode;
		this.element = element;
	}
}
export class RNothing extends RNodeBase {
	type = "nothing" as const;
	element = new Text();
	constructor(public vNode: VNothing, parent: Element, at: number) {
		super();
		parent.insertBefore(this.element, parent.childNodes[at] ?? null);
	}
	position() {
		return position(this.element);
	}
	unmount() {
		this.element.remove();
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
	if (r instanceof RElement && isVElement(newVNode) && r.vNode.type === newVNode.type) {
		r.update(newVNode, layer);
		return r;
	}
	if (r instanceof RComponent && isVComponent(newVNode) && r.vNode.type === newVNode.type) {
		r.update(newVNode);
		return r;
	}
	if (r instanceof RArray && isVArray(newVNode)) {
		r.update(newVNode, layer);
		return r;
	}
	if (r instanceof RText && isVText(newVNode)) {
		r.update(newVNode);
		return r;
	}
	if (r instanceof RNothing && isVNothing(newVNode)) {
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
