export interface VElement {
	$type: "$VEl";
	type: string;
	props: Record<string, any>;
	children: VNode;
}
export interface VComponent<P extends Record<string, any>> {
	$type: "$VCo";
	type: (props: P) => VNode;
	props: P;
}
export type VArray = VNode[];
export type VText = number | string;
export type VNothing = boolean | null | undefined;
export type VNode = VElement | VComponent<any> | VArray | VText | VNothing;

export function isVElement(vNode: VNode): vNode is VElement {
	return (vNode as any)?.$type === "$VEl";
}
export function isVComponent(vNode: VNode): vNode is VComponent<any> {
	return (vNode as any)?.$type === "$VCo";
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
