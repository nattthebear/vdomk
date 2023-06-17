export interface VElement {
	$type: "$VEl";
	type: string;
	props: Record<string, any>;
	children: VNode;
}
export type VArray = VNode[];
export type VText = number | string;
export type VNothing = boolean | null | undefined;
export type VNode = VElement | VArray | VText | VNothing;

export function isVElement(vNode: VNode): vNode is VElement {
	return (vNode as any)?.$type === "$VEl";
}
const { isArray } = Array;
export function isVArray(vNode: VNode): vNode is VArray {
	return isArray(vNode);
}
export function isVText(vNode: VNode): vNode is VText {
	const t = typeof vNode;
	return t === "number" || t === "string";
}
export function isVNothing(vNode: VNode): vNode is VNothing {
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
