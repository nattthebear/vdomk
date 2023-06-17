import { VElement } from "./vdom";

const EMPTY_ARRAY: never[] = [];
const EMPTY_OBJECT: Record<string, never> = {};

export function h(type: any, argProps: any, ...argChildren: any[]): VElement {
	const { children, ...props } = argProps ?? EMPTY_OBJECT;
	const ret: VElement = {
		$type: "$VEl",
		type,
		props: props || null,
		children: argChildren.length > 0 ? argChildren : children ?? EMPTY_ARRAY,
	};

	return ret;
}
