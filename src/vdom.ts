import type { VElement, VComponent, VArray, VText, VNode } from "./types";

export function isVElement(vNode: VNode): vNode is VElement {
	return typeof (vNode as any)?.type === "string";
}
export function isVComponent(vNode: VNode): vNode is VComponent {
	return typeof (vNode as any)?.type === "function";
}
const { isArray } = Array;
export function isVArray(vNode: VNode): vNode is VArray {
	return isArray(vNode);
}
export function isVText(vNode: VNode): vNode is VText {
	return vNode == null || typeof vNode !== "object";
}
export function getVKey(vNode: VNode): KeyType {
	return (vNode as any)?.key;
}
