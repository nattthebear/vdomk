import { VArray, VComponent, VElement, VNode } from "./vdom";
import type { Component } from "./Component";

const EMPTY_ARRAY: never[] = [];
const EMPTY_OBJECT: Record<string, never> = {};

export const Fragment = Symbol("vdomk.Fragment");

export function h(
	type: Component<any> | string | typeof Fragment,
	props: Record<string, any> | null,
	...children: any[]
): VElement | VComponent | VArray {
	if (type === Fragment) {
		const ret: VArray = children.length > 0 ? children : props?.children ?? EMPTY_ARRAY;
		return ret;
	}
	if (children.length > 0) {
		props = { ...props, children: children };
	}
	if (typeof type === "function") {
		const ret: VComponent = {
			$type: "$VCo",
			type,
			key: props?.key,
			props,
		};
		return ret;
	}
	const ret: VElement = {
		$type: "$VEl",
		type,
		key: props?.key,
		props: props ?? EMPTY_OBJECT,
	};
	return ret;
}
