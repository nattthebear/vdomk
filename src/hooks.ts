import { getCurrentHookState, hookScheduleUpdate } from "./Component";

const { is } = Object;

export interface RefObject<T> {
	current: T;
}
export function useRef<T>(initialValue: T): RefObject<T>;
export function useRef<T>(): RefObject<T | undefined>;
export function useRef(initialValue?: any) {
	return getCurrentHookState(() => ({ current: initialValue }));
}

export type UpdateState<S> = (newValue: S | ((oldValue: S) => S)) => void;
export type UseStateResult<S> = [S, UpdateState<S>];
export function useState<S>(initialValue: S) {
	return getCurrentHookState(() => {
		const result: UseStateResult<S> = [
			initialValue,
			(newValue) => {
				let nextValue: S;
				if (typeof newValue === "function") {
					nextValue = (newValue as (oldValue: S) => S)(result[0]);
				} else {
					nextValue = newValue;
				}
				if (!is(result[0], nextValue)) {
					result[0] = nextValue;
					hookScheduleUpdate();
				}
			},
		];
		return result;
	});
}

export type Reducer<S, A> = (prevState: S, action: A) => S;
export type UseReducerResult<S, A> = [S, (action: A) => void];
export function useReducer<S, A>(reducer: Reducer<S, A>, initialState: S) {
	return getCurrentHookState(() => {
		const result: UseReducerResult<S, A> = [
			initialState,
			(action) => {
				const nextValue = reducer(result[0], action);
				if (!is(result[0], nextValue)) {
					result[0] = nextValue;
					hookScheduleUpdate();
				}
			},
		];
		return result;
	});
}

function shallowEqual<T extends any[]>(x: T, y: T) {
	if (x.length !== y.length) {
		return false;
	}
	for (let i = 0; i < x.length; i++) {
		if (!is(x[i], y[i])) {
			return false;
		}
	}
	return true;
}

type UseMemoStore<A extends any[], R> = { args: A; value: R } | { args: undefined; value: undefined };
export function useMemo<A extends any[], R>(callback: (...args: A) => R, deps: A) {
	const store = getCurrentHookState<UseMemoStore<A, R>>(() => ({ args: undefined, value: undefined }));
	if (!store.args || !shallowEqual(store.args, deps)) {
		store.args = deps;
		store.value = callback(...deps);
	}
	return store.value as R;
}

export function useEffect<A extends any[]>(callback: (...args: A) => (() => void) | undefined, deps: A) {
	// TODO
	setTimeout(() => callback(...deps), 0);
}
