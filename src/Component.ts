import { Heap } from "./Heap";
import { RNode, diff } from "./diff";
import { VNode } from "./vdom";

const defer = Promise.prototype.then.bind(Promise.resolve());
const pendingUpdates = new Heap(compareLayers);
let updateCount = 0;
function compareLayers(x: ComponentLayer, y: ComponentLayer) {
	return x.depth < y.depth;
}

function deferFlush() {
	const updateNumber = ++updateCount;
	defer(() => {
		if (updateNumber !== updateCount) {
			return;
		}
		let layer: ComponentLayer | undefined;
		while ((layer = pendingUpdates.remove())) {
			layer.runUpdate();
		}
	});
}

let currentLayer: ComponentLayer | undefined;
let currentHookIndex = 0;

export class ComponentLayer<P extends Record<string, any> = any> {
	depth: number;
	alive = true;
	pending = true;
	hookState: any[] | undefined;
	constructor(
		public rNode: RNode,
		public parent: ComponentLayer | undefined,
		public component: (props: P) => VNode,
		public propsAccessor: () => P
	) {
		this.depth = parent ? parent.depth + 1 : 0;
	}
	getHookState() {
		return (this.hookState ??= []);
	}
	runUpdate() {
		currentLayer = this;
		currentHookIndex = 0;
		let newVNode: VNode;
		try {
			newVNode = (0, this.component)(this.propsAccessor());
		} finally {
			currentLayer = undefined;
		}
		this.pending = false;
		this.rNode = diff(this.rNode, newVNode, this);
	}
	scheduleUpdate() {
		if (!this.alive || this.pending) {
			return;
		}
		this.pending = true;
		pendingUpdates.insert(this);
		deferFlush();
	}
	unmount() {
		this.alive = false;
		this.rNode = diff(this.rNode, undefined, this);
	}
}

export function getCurrentHookState<T>(initializer: () => T) {
	const hooks = currentLayer!.getHookState();
	if (currentHookIndex >= hooks.length) {
		return (hooks[currentHookIndex++] = initializer());
	}
	return hooks[currentHookIndex++] as T;
}
export function hookScheduleUpdate() {
	currentLayer!.scheduleUpdate();
}
