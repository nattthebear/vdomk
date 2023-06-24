import { cleanup, scheduleUpdate } from "./hooks";
import type { Component, LayerInstance, ComponentLayer, VNode } from "./types";

export type Provider<T> = Component<{ value: T; children: VNode }>;
export type Subscribe<T> = {
	<S>(instance: LayerInstance, selector: (input: T) => S, equal?: (x: S, y: S) => boolean): () => S;
	(instance: LayerInstance, selector?: undefined, equal?: (x: T, y: T) => boolean): () => T;
};

export interface Context<T> {
	Provider: Provider<T>;
	subscribe: Subscribe<T>;
}

export interface ContextData<T = unknown> {
	type: Context<T>;
	value: T;
	subs: Set<() => void>;
}

export function createContext<T>(defaultValue: T, equal: (x: T, y: T) => boolean = Object.is): Context<T> {
	const ret: Context<T> = {
		Provider({ value }, instance) {
			const data: ContextData<T> = {
				type: ret,
				value,
				subs: new Set(),
			};
			(instance as any as ComponentLayer).context = data as ContextData<unknown>;
			return (nextProps) => {
				const newValue = nextProps.value;
				if (!equal(data.value, newValue)) {
					data.value = newValue;
					for (const sub of data.subs) {
						sub();
					}
				}
				return nextProps.children;
			};
		},
		subscribe(instance: LayerInstance, selector = (v: any) => v, equal = Object.is) {
			for (let layer = instance as any as ComponentLayer | undefined; layer; layer = layer.parentLayer) {
				const { context } = layer;
				if (context?.type === ret) {
					const accessor = () => selector(context.value);
					let value = accessor();
					function sub() {
						let shouldUpdate = true;
						try {
							shouldUpdate = !equal(value, accessor());
						} catch {
							// https://react-redux.js.org/api/hooks#stale-props-and-zombie-children
						}
						if (shouldUpdate) {
							scheduleUpdate(instance);
						}
					}
					context.subs.add(sub);
					cleanup(instance, () => context.subs.delete(sub));
					return () => (value = accessor());
				}
			}
			return () => selector(defaultValue);
		},
	};
	return ret;
}
