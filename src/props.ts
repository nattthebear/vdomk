import { enqueueEffect } from "./root";

const EVENT_REGEX = /^on([a-z]+?)(capture)?$/i;
const SKIP_REGEX = /^children|value|checked$/;

/**
 * Set a prop on a DOM Element.  Might attach events, set DOM attributes, fire refs, or set DOM properties.
 * @param element The Element to set a property on.
 * @param key The property name.
 * @param oldValue The value that was set in a previous diff or mount operation.  Will be `undefined` on mount, or if that value was not present in props.
 * @param newValue The desired new value.  Will be `undefined` if that value is no longer present in props.
 * @param isSvg If true, element is an svg element and some namespace or property type differences may be applied.
 * @param depth The layer depth to execute ref effects at.
 */
export function setProperty(
	element: Element,
	key: string,
	oldValue: any,
	newValue: any,
	isSvg: boolean,
	depth: number
) {
	if (oldValue === newValue || SKIP_REGEX.test(key)) {
		return;
	}
	if (key === "ref") {
		oldValue?.(null);
		enqueueEffect(depth, () => newValue?.(element));
		return;
	}

	let match: RegExpMatchArray | null;
	if ((match = key.match(EVENT_REGEX))) {
		let [, eventName, captureName] = match;
		eventName = eventName.toLowerCase();
		const useCapture = !!captureName;
		if (oldValue) {
			element.removeEventListener(eventName, oldValue, useCapture);
		}
		if (newValue) {
			element.addEventListener(eventName, newValue, useCapture);
		}
		return;
	}

	if (!isSvg && key in element) {
		(element as any)[key] = newValue;
		return;
	}

	if (newValue == null) {
		element.removeAttribute(key);
	} else {
		element.setAttribute(key, newValue);
	}
}

/**
 * Set certain input props diffed against the DOM to handle controlled input issues.
 * @param element The element to set a property on.
 * @param key The property name.
 * @param props The props object that may contain [key].
 */
export function setControlledInputProps(
	element: HTMLInputElement | HTMLSelectElement,
	key: "value" | "checked",
	props: Record<string, any>
) {
	if (key in props) {
		const value = props[key];
		if (value !== undefined && value !== (element as any)[key]) {
			(element as any)[key] = value ?? "";
		}
	}
}
