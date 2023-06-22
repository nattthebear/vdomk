import { VArray, VComponent, VElement, VNode } from "./vdom";
import type { Component } from "./Component";

const EMPTY_ARRAY: never[] = [];
const EMPTY_OBJECT: Record<string, never> = {};

export const Fragment = Symbol("vdomk.Fragment");

export function h<K extends keyof JSX.IntrinsicElements>(
	type: K,
	props: JSX.IntrinsicElements[K] | null,
	...children: VNode[]
): VElement;
export function h<P extends Record<string, any>>(type: Component<P>, props: P): VComponent<P>;
export function h(type: typeof Fragment, props: { children?: VNode[] }): VArray;
export function h(
	type: Component<any> | string | typeof Fragment,
	props: Record<string, any> | null,
	...children: any[]
): VElement | VComponent | VArray {
	const key = props?.key;
	if (type === Fragment) {
		const ret: VArray = children.length > 0 ? children : props?.children ?? EMPTY_ARRAY;
		if (key !== undefined) {
			ret.key = key;
		}
		return ret;
	}
	if (children.length > 0) {
		props = { ...props, children: children };
	}
	if (typeof type === "function") {
		const ret: VComponent = {
			$type: "$VCo",
			type,
			key,
			props,
		};
		return ret;
	}
	const ret: VElement = {
		$type: "$VEl",
		type,
		key,
		props: props ?? EMPTY_OBJECT,
	};
	return ret;
}
