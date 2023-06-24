import { cleanup, scheduleUpdate } from "./hooks";
import type { Component, LayerInstance, ComponentLayer, VNode } from "./types";

export type Provider<T> = Component<{ value: T; children: VNode }>;
export type Subscribe<T> = (instance: LayerInstance) => () => T;

export interface Context<T> {
	Provider: Provider<T>;
	subscribe: Subscribe<T>;
}

export interface ContextData<T = unknown> {
	type: Context<T>;
	value: T;
	subs: Set<() => void>;
}

export function createContext<T>(defaultValue: T, equal?: (x: T, y: T) => boolean): Context<T> {
	equal ??= Object.is;
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
				if (!equal!(data.value, newValue)) {
					data.value = newValue;
					for (const sub of data.subs) {
						sub();
					}
				}
				return nextProps.children;
			};
		},
		subscribe(instance) {
			for (let layer = instance as any as ComponentLayer | undefined; layer; layer = layer.parentLayer) {
				const { context } = layer;
				if (context?.type === ret) {
					function sub() {
						scheduleUpdate(instance);
					}
					context.subs.add(sub);
					cleanup(instance, () => context.subs.delete(sub));
					return () => context.value as T;
				}
			}
			return () => defaultValue;
		},
	};
	return ret;
}
