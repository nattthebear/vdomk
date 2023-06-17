const EVENT_REGEX = /^(on)?([a-z]+?)(capture)?$/i;

export function setProperty(element: Element, key: string, oldValue: any, newValue: any) {
	if (oldValue === newValue) {
		return;
	}

	let match: RegExpMatchArray | null;
	if ((match = key.match(EVENT_REGEX))) {
		let [, , eventName, capture] = match;
		eventName = eventName.toLowerCase();
		if (oldValue) {
			element.removeEventListener(eventName, oldValue, !!capture);
		}
		if (newValue) {
			element.addEventListener(eventName, newValue, !!capture);
		}
		return;
	}

	if (key in element) {
		(element as any)[key] = newValue;
		return;
	}

	if (newValue == null) {
		element.removeAttribute(key);
	} else {
		element.setAttribute(key, newValue);
	}
}
