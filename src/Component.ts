import { RNode, diff } from "./diff";
import type { RootComponentFunctions } from "./root";
import type { Component, Hooks, OPC, VNode } from "./types";

/** Keeps track of a Component.  This could be merged with RComponent. */
export class ComponentLayer<P extends Record<string, any> = any> {
	depth: number;
	alive = true;
	pending = true;
	cleanupQueue: (() => void)[] | undefined;
	hooks: Hooks;
	component: OPC<P>;
	constructor(
		public rNode: RNode,
		public parent: ComponentLayer | undefined,
		public root: RootComponentFunctions,
		component: Component<P>,
		public propsAccessor: () => P
	) {
		this.depth = parent ? parent.depth + 1 : 0;
		this.hooks = {
			cleanup: (cb) => {
				if (this.alive) {
					(this.cleanupQueue ??= []).push(cb);
				}
			},
			effect: this.root.enqueueEffect,
			scheduleUpdate: () => {
				this.scheduleUpdate();
			},
		};
		let newVNode: VNode;
		const res = component(propsAccessor(), this.hooks);
		if (typeof res === "function") {
			this.component = res;
			newVNode = res(propsAccessor(), this.hooks);
		} else {
			this.component = component as OPC<P>;
			newVNode = res;
		}
		this.finishUpdate(newVNode);
	}
	runUpdate(force: boolean) {
		if (this.alive && (this.pending || force)) {
			this.finishUpdate((0, this.component)(this.propsAccessor(), this.hooks));
		}
	}
	private finishUpdate(newVNode: VNode) {
		this.pending = false;
		this.rNode = diff(this.rNode, newVNode, this);
	}
	scheduleUpdate() {
		if (!this.alive || this.pending) {
			return;
		}
		this.pending = true;
		this.root.enqueueLayer(this);
	}
	unmount() {
		this.alive = false;
		const { cleanupQueue } = this;
		if (cleanupQueue) {
			for (let i = cleanupQueue.length - 1; i >= 0; i--) {
				cleanupQueue[i]();
			}
		}
		this.rNode.unmount(true);
	}
}
