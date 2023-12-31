import type { VArray, VComponent, VElement, VNode, Component } from "./types";

const EMPTY_OBJECT: Record<string, never> = {};

export const Fragment = Symbol("vdomk.Fragment");

export function h<K extends keyof JSX.IntrinsicElements>(
	type: K,
	props: JSX.IntrinsicElements[K] | null,
	...children: VNode[]
): VElement<K>;
export function h(type: string, props: JSX.HTMLAttributes<HTMLElement> | null, ...children: VNode[]): VElement;
export function h<P extends Record<string, any>>(type: Component<P>, props: P): VComponent<P>;
export function h<P extends { children: any[] }>(
	type: Component<P>,
	props: Omit<P, "children">,
	...children: P["children"]
): VComponent<P>;
export function h(type: typeof Fragment, props: { children?: VNode[] } | null): VArray;
export function h(
	type: Component<any> | string | typeof Fragment,
	props: Record<string, any> | null,
	...children: any[]
): VElement | VComponent | VArray {
	const key = props?.key;
	const { length } = children;
	if (type === Fragment) {
		if (key === undefined) {
			return length > 1 ? children : length ? children[0] : props?.children;
		}
		const ret: VArray = length ? children : [props?.children];
		ret.key = key;
		return ret;
	}
	if (length) {
		props = { ...props, children: length > 1 ? children : children[0] };
	}
	return {
		type,
		key,
		props: props ?? EMPTY_OBJECT,
	} as VElement | VComponent;
}
export function jsx<K extends keyof JSX.IntrinsicElements>(
	type: K,
	props: JSX.IntrinsicElements[K],
	key?: KeyType
): VElement<K>;
export function jsx(type: string, props: JSX.HTMLAttributes<HTMLElement>, key?: KeyType): VElement;
export function jsx<P extends Record<string, any>>(type: Component<P>, props: P, key?: KeyType): VComponent<P>;
export function jsx(type: typeof Fragment, props: { children?: VNode }, key?: KeyType): VArray;
export function jsx(
	type: string | Component<any> | typeof Fragment,
	props: Record<string, any>,
	key?: KeyType
): VElement | VComponent | VArray {
	if (type === Fragment) {
		if (key === undefined) {
			return props.children;
		}
		const ret: VArray = [props.children];
		ret.key = key;
		return ret;
	}
	return {
		type,
		key,
		props,
	} as VElement | VComponent;
}
