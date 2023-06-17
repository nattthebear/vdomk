import { describe, snapshot } from "./snapshots";
import { JSDOM } from "jsdom";
import { createRoot } from "../diff";
import { VNode, VElement } from "../vdom";
import { h } from "../createElement";

describe("render tests", import.meta.url, (it) => {
	function doTest(name: string, vNode: VNode) {
		it(name, () => {
			const dom = new JSDOM(`<!DOCTYPE html><html><head><body>`);
			global.document = dom.window.document;
			global.Text = dom.window.Text;
			try {
				const root = createRoot(dom.window.document.body);
				root.render(vNode);
				snapshot(dom.window.document.body.innerHTML);
			} finally {
				delete (global as any).document;
				delete (global as any).Text;
			}
		});
	}
	doTest("first test", <div />);
	doTest("nothing 1", null);
	doTest("nothing 1", undefined);
	doTest("nothing 1", true);
	doTest("nothing 1", false);
	doTest("text 1", 12345);
	doTest("text 2", "abcde");
	doTest("text 3", "<div></div>");
});
