export type {
	KeyType,
	VElement,
	VComponent,
	VArray,
	VText,
	VNode,
	ComponentContext,
	OPC,
	TPC,
	Component,
	RenderRoot,
} from "./types";
export { cleanup, effect, scheduleUpdate } from "./hooks";
export { h, Fragment } from "./createElement";
export { createRoot } from "./root";
import "./jsx";
