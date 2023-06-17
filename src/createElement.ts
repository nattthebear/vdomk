import { VComponent, VElement, VNode } from "./vdom";

const EMPTY_ARRAY: never[] = [];
const EMPTY_OBJECT: Record<string, never> = {};

export function h(
	type: ((props: any) => VNode) | string,
	argProps: Record<string, any> | null,
	...argChildren: any[]
): VElement | VComponent {
	if (typeof type === "function") {
		let props = argProps;
		if (argChildren.length > 0) {
			props = { ...props, children: argChildren };
		}
		const ret: VComponent = {
			$type: "$VCo",
			type,
			props,
		};
		return ret;
	}
	const { children, ...props } = argProps ?? EMPTY_OBJECT;
	const ret: VElement = {
		$type: "$VEl",
		type,
		props,
		children: argChildren.length > 0 ? argChildren : children ?? EMPTY_ARRAY,
	};

	return ret;
}
