// VDOM Public ================================================================

/** Used for keyed reconciliation */
export type KeyType = string | number | symbol | null | undefined;
/** VNode representing a DOM element */
export interface VElement<K extends keyof JSX.IntrinsicElements = keyof JSX.IntrinsicElements> {
	type: K;
	key: KeyType;
	props: JSX.IntrinsicElements[K];
}
/** VNode representing a function component */
export interface VComponent<P extends Record<string, any> = any> {
	type: Component<P>;
	key: KeyType;
	props: P;
}
/** VNode representing an array or fragment */
export type VArray = VNode[] & { key?: KeyType };
/** VNode for raw text content.  Boolean or nullish will render nothing at all. */
export type VText = number | string | boolean | null | undefined;
/** The sum type for all renderable things.  VNodes should be treated as opaque and immutable. */
export type VNode = VNodeTypes[keyof VNodeTypes];

// VDOM Private ===============================================================

/** All VNode types; add more with decl merging */
export interface VNodeTypes {
	element: VElement;
	component: VComponent;
	array: VArray;
	text: VText;
}

// Component Public ===========================================================

declare const LayerBrand: unique symbol;

/** The component context that hooks need to work with.  Has no publicly accessible methods. */
export interface LayerInstance {
	brand: typeof LayerBrand;
}

/**
 * One Phase Component.  Similar to a React hookless stateless component.
 * The provided function is called for each rerender.
 * Hooks may be used, but `cleanup` doesn't make much sense.
 */
export type OPC<P extends Record<string, any>> = (props: P, instance: LayerInstance) => VNode;
/**
 * Two Phase Component.  The provided function is called once on mount,
 * and then the function it returns is called for each rerender.
 * The provided function is called for each rerender.
 * Hooks are fully supported, but `cleanup` only makes sense on mount.
 */
export type TPC<P extends Record<string, any>> = (props: P, instance: LayerInstance) => OPC<P>;
export type Component<P extends Record<string, any>> = OPC<P> | TPC<P>;

// Root Public ================================================================

export interface RenderRoot {
	/**
	 * Render new content in the root, diffing with existing content and unmounting/mounting new components as needed.
	 * This is scheduled asynchronously and participates with normal component render batching.
	 * @param newVNode the new content to render
	 * @returns a Promise that resolves after the content has been rendered
	 */
	render(newVNode: VNode): Promise<void>;
	/** Unmount this root entirely, unmounting all child components and removing all nodes.  It can no longer be used. */
	unmount(): void;
}
