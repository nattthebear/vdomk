// VDOM Public ================================================================

/** Used for keyed reconciliation */
export type KeyType = string | number | symbol | null | undefined;
/** VNode representing a DOM element */
export interface VElement {
	$type: "$VEl";
	type: string;
	key: KeyType;
	props: Record<string, any>;
}
/** VNode representing a function component */
export interface VComponent<P extends Record<string, any> = any> {
	$type: "$VCo";
	type: Component<P>;
	key: KeyType;
	props: P;
}
/** VNode representing an array or fragment */
export type VArray = VNode[] & { key?: KeyType };
/** VNode for raw text content.  Boolean or nullish will render nothing at all. */
export type VText = number | string | boolean | null | undefined;
/** The sum type for all renderable things.  VNodes should be treated as opaque and immutable. */
export type VNode = VElement | VComponent | VArray | VText;

// Component Public ===========================================================

export interface Hooks {
	/** Registers a function to be called when this component is unmounted. */
	cleanup(cb: () => void): void;
	/** Calls a function in the effect phase after this render completes. */
	effect(cb: () => void): void;
	/** Schedules a rerender of this component. */
	scheduleUpdate(): void;
}

/**
 * One Phase Component.  Similar to a React hookless stateless component.
 * The provided function is called for each rerender.
 * Hooks may be used, but `cleanup` doesn't make much sense.
 */
export type OPC<P extends Record<string, any>> = (props: P, hooks: Hooks) => VNode;
/**
 * Two Phase Component.  The provided function is called once on mount,
 * and then the function it returns is called for each rerender.
 * The provided function is called for each rerender.
 * Hooks are fully supported, but `cleanup` only makes sense on mount.
 */
export type TPC<P extends Record<string, any>> = (props: P, hooks: Hooks) => OPC<P>;
export type Component<P extends Record<string, any>> = OPC<P> | TPC<P>;

// Root Public ================================================================

export interface RenderRoot {
	/** Render new content in the root, diffing with existing content and unmounting/mounting new components as needed. */
	render(newVNode: VNode): void;
	/** Unmount this root entirely, unmounting all child components and removing all nodes.  It can no longer be used. */
	unmount(): void;
}
