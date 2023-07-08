import { JSDOM } from "jsdom";

const names: (keyof typeof globalThis)[] = ["document", "Text", "Range"];

function installWindow(dom: JSDOM) {
	for (const name of names) {
		(global as any)[name] = dom.window[name];
	}
}
function uninstallWindow() {
	for (const name of names) {
		delete (global as any)[name];
	}
}

export function wrapInDOM(callback: (dom: JSDOM) => void) {
	const dom = new JSDOM(`<!DOCTYPE html><html><head><body>`);
	installWindow(dom);
	try {
		callback(dom);
	} finally {
		uninstallWindow();
	}
}
export async function wrapInDOMAsync(callback: (dom: JSDOM) => Promise<void>) {
	const dom = new JSDOM(`<!DOCTYPE html><html><head><body>`);
	installWindow(dom);
	try {
		await callback(dom);
	} finally {
		uninstallWindow();
	}
}
