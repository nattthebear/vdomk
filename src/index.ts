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
