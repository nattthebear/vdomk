export type {
	KeyType,
	VElement,
	VComponent,
	VArray,
	VText,
	VNode,
	LayerInstance,
	OPC,
	TPC,
	Component,
	RenderRoot,
} from "./types";
export { cleanup, effect, scheduleUpdate } from "./hooks";
export { h, jsx, Fragment } from "./createElement";
export { createRoot } from "./root";
import "./jsx";

export type { Provider, Subscribe, Context } from "./context";
export { createContext } from "./context";

export type { PortalProps, VPortal } from "./portal";
export { Portal, createPortal } from "./portal";
