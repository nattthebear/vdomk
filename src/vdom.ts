import type { Component } from "./Component";

export type KeyType = string | number | symbol | null | undefined;
export interface VElement {
	$type: "$VEl";
	type: string;
	key: KeyType;
	props: Record<string, any>;
}
export interface VComponent<P extends Record<string, any> = any> {
	$type: "$VCo";
	type: Component<P>;
	key: KeyType;
	props: P;
}
export type VArray = VNode[];
export type VText = number | string | boolean | null | undefined;
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
