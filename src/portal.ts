import { RNode, RNodeBase, RNodeFactory, diff, mount, rNodeFactories } from "./diff";
import { ComponentLayer, KeyType, VNode } from "./types";

export const Portal = /*#__PURE__*/ Symbol("vdomk.Portal");

export interface PortalProps {
	container: Element;
	adjacent: Node | null;
	children: VNode;
}

export interface VPortal {
	type: typeof Portal;
	key: KeyType;
	props: PortalProps;
}

declare module "./types" {
	export interface VNodeTypes {
		portal: VPortal;
	}
}

function isVPortal(vNode: VNode): vNode is VPortal {
	return (vNode as any)?.type === Portal;
}

class RPortal extends RNodeBase<VPortal> {
	children: RNode;
	element = new Text();
	static guard = isVPortal;
	constructor(public vNode: VPortal, parent: Element, adjacent: Node | null, layer: ComponentLayer) {
		super();
		parent.insertBefore(this.element, adjacent);
		const { props } = vNode;
		this.children = mount(props.children, props.container, props.adjacent, layer);
	}
	unmount(removeSelf: boolean) {
		this.children.unmount(true);
		super.unmount(removeSelf);
	}
	update(vNode: VPortal, layer: ComponentLayer) {
		const oldProps = this.vNode.props;
		const newProps = vNode.props;
		if (oldProps.container !== newProps.container) {
			return false;
		}
		this.children = diff(this.children, newProps.children, layer);
		if (oldProps.adjacent !== newProps.adjacent) {
			this.children.moveTo(newProps.adjacent);
		}
		return true;
	}
}
interface RPortal {
	constructor: typeof RPortal & RNodeFactory<VPortal>;
}
declare module "./diff" {
	export interface RNodeTypes {
		portal: RPortal;
	}
}

rNodeFactories.push(RPortal satisfies RNodeFactory<VPortal>);

export function createPortal(
	container: Element,
	children: VNode,
	key?: KeyType,
	adjacent: Node | null | undefined = null
): VPortal {
	return {
		type: Portal,
		key,
		props: {
			container,
			adjacent,
			children,
		},
	};
}
