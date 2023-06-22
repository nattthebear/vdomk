const EVENT_REGEX = /^on([a-z]+?)(capture)?$/i;

/**
 * Set a prop on a DOM Element.  Might attach events, set DOM attributes, fire refs, or set DOM properties.
 * @param element The Element to set a property on.
 * @param key The property name.
 * @param oldValue The value that was set in a previous diff or mount operation.  Will be `undefined` on mount, or if that value was not present in props.
 * @param newValue The desired new value.  Will be `undefined` if that value is no longer present in props.
 * @param isSvg If true, element is an svg element and some namespace or property type differences may be applied.
 */
export function setProperty(element: Element, key: string, oldValue: any, newValue: any, isSvg: boolean) {
	if (oldValue === newValue) {
		return;
	}
	if (key === "children") {
		return;
	}
	if (key === "ref") {
		oldValue?.(null);
		newValue?.(element);
		return;
	}

	let match: RegExpMatchArray | null;
	if ((match = key.match(EVENT_REGEX))) {
		let [, eventName, capture] = match;
		eventName = eventName.toLowerCase();
		if (oldValue) {
			element.removeEventListener(eventName, oldValue, !!capture);
		}
		if (newValue) {
			element.addEventListener(eventName, newValue, !!capture);
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
