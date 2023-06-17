import { setProperty } from "./props";

interface VElement {
	$type: "$VEl";
	type: string;
	props: Record<string, any>;
	children: VNode;
}
type VArray = VNode[];
type VText = number | string;
type VNothing = boolean | null | undefined;
type VNode = VElement | VArray | VText | VNothing;

function isVElement(vNode: VNode): vNode is VElement {
	return (vNode as any)?.$type === "$VEl";
}
const { isArray } = Array;
function isVArray(vNode: VNode): vNode is VArray {
	return isArray(vNode);
}
function isVText(vNode: VNode): vNode is VText {
	const t = typeof vNode;
	return t === "number" || t === "string";
}
function isVNothing(vNode: VNode): vNode is VNothing {
	return vNode == null || typeof vNode === "boolean";
}
function vType(vNode: VNode) {
	if (isVElement(vNode)) {
		return "element";
	}
	if (isVArray(vNode)) {
		return "array";
	}
	if (isVText(vNode)) {
		return "text";
	}
	return "nothing";
}

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
class RElement extends RNodeBase {
	type = "element" as const;
	children: RNode;
	element: Element;
	constructor(public vNode: VElement, parent: Element, at: number) {
		super();
		const element = document.createElement(vNode.type);
		parent.insertBefore(element, parent.childNodes[at] ?? null);
		this.element = element;
		this.children = mount(vNode.children, element, 0);
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
	update(vNode: VElement) {
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
		this.children = diff(this.children, this.vNode.children);
	}
}
class RArray extends RNodeBase {
	type = "array" as const;
	children: RNode[];
	start = new Text();
	end = new Text();
	constructor(public vNode: VArray, parent: Element, at: number) {
		super();
		parent.insertBefore(this.end, parent.childNodes[at] ?? null);
		parent.insertBefore(this.start, this.end);
		this.children = vNode.map((v, i) => mount(v, parent, at + i + 1));
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
	update(vNode: VArray) {
		const oldVNode = this.vNode;
		let i = 0;
		for (; i < vNode.length && i < oldVNode.length; i++) {
			this.children[i] = diff(this.children[i], vNode[i]);
		}
		for (; i < oldVNode.length; i++) {
			this.children[i].unmount();
		}
		this.children.length = vNode.length;
		const { parent, at } = this.position();
		for (; i < vNode.length; i++) {
			this.children[i] = mount(vNode[i], parent, at + i + 1);
		}
		this.vNode = vNode;
	}
}
class RText extends RNodeBase {
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
class RNothing extends RNodeBase {
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
type RNode = RElement | RArray | RText | RNothing;

function mount(vNode: VNode, parent: Element, at: number): RNode {
	if (isVElement(vNode)) {
		return new RElement(vNode, parent, at);
	}
	if (isVArray(vNode)) {
		return new RArray(vNode, parent, at);
	}
	if (isVText(vNode)) {
		return new RText(vNode, parent, at);
	}
	return new RNothing(vNode, parent, at);
}

function diff(r: RNode, newVNode: VNode) {
	if (r.vNode === newVNode) {
		return r;
	}
	if (r instanceof RElement && isVElement(newVNode) && r.vNode.type === newVNode.type) {
		r.update(newVNode);
		return r;
	}
	if (r instanceof RArray && isVArray(newVNode)) {
		r.update(newVNode);
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
	return mount(newVNode, parent, at);
}
