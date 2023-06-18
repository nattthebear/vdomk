import { describe, snapshot } from "./snapshots";
import { JSDOM } from "jsdom";
import { createRoot } from "../root";
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
	doTest("nothing 2", undefined);
	doTest("nothing 3", true);
	doTest("nothing 4", false);
	doTest("text 1", 12345);
	doTest("text 2", "abcde");
	doTest("text 3", "<div></div>");
	doTest("children!", <div>Hello there!</div>);
	doTest(
		"children 2",
		<div>
			<span></span>
		</div>
	);
	doTest("array", ["a", "b", "c", "d"]);
	doTest("array 2", ["ab", "c", null, false, "d"]);
	doTest("array 3", ["ab", "c", <div />, false, "d"]);
	doTest("prop-children", <div children={<div />} />);
	doTest(
		"attribs",
		<div class="huh">
			<span style="color: black;">Hey hey hey</span>
		</div>
	);
	doTest("props", <div tabIndex={3} />);
	function Component() {
		return <div />;
	}
	doTest("component", <Component />);
	function Pomponent({ foo }: { foo: string }) {
		return <div>{foo}</div>;
	}
	doTest(
		"component with props",
		<span>
			<Pomponent foo="wow" />
		</span>
	);
	doTest("nested arrays", ["a", "b", ["c", "d"], "e"]);
});
