import { Component, TPC, VNode } from "./types";

const { is } = Object;
function shallowEqual<T extends Record<string, any>>(x: T, y: T) {
	for (const k in x) {
		if (!is(x[k], y[k])) {
			return false;
		}
	}
	for (const k in y) {
		if (!(k in x) && !is(x[k], y[k])) {
			return false;
		}
	}
	return true;
}

/** Wraps a component with one that will not rerender so long as the props are shallow-equal to the old props. */
export const memo = <P extends Record<string, any>>(
	component: Component<P>,
	equal: (x: P, y: P) => boolean = shallowEqual
): TPC<P> =>
	function MemoComponent() {
		let prevProps: P | undefined;
		let prevResult: VNode;
		return (props) => {
			if (!prevProps || !equal(prevProps, props)) {
				prevProps = props;
				prevResult = { type: component, key: undefined, props };
			}
			return prevResult;
		};
	};
