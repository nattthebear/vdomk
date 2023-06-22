import type { Component } from "./Component";

/** Used for keyed reconciliation */
export type KeyType = string | number | symbol | null | undefined;
/** VNode representing a DOM element */
export interface VElement {
	$type: "$VEl";
	type: string;
	key: KeyType;
	props: Record<string, any>;
}
/** VNode representing a function component */
export interface VComponent<P extends Record<string, any> = any> {
	$type: "$VCo";
	type: Component<P>;
	key: KeyType;
	props: P;
}
/** VNode representing an array or fragment */
export type VArray = VNode[] & { key?: KeyType };
/** VNode for raw text content.  Boolean or nullish will render nothing at all. */
export type VText = number | string | boolean | null | undefined;
/** The sum type for all renderable things.  VNodes should be treated as opaque and immutable. */
export type VNode = VElement | VComponent | VArray | VText;

export function isVElement(vNode: VNode): vNode is VElement {
	return (vNode as any)?.$type === "$VEl";
}
export function isVComponent(vNode: VNode): vNode is VComponent {
	return (vNode as any)?.$type === "$VCo";
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
