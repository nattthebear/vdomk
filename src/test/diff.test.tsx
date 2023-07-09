import { describe, snapshot } from "./snapshots";
import assert from "node:assert/strict";
import { createRoot } from "../root";
import { h } from "../createElement";
import type { VNode } from "../types";
import "../portal";
import { wrapInDOM, wrapInDOMAsync } from "./util";

describe("render tests", import.meta.url, (it) => {
	function doTest(name: string, vNode: VNode) {
		it(name, () => {
			wrapInDOM((dom) => {
				const root = createRoot(dom.window.document.body, vNode);
				snapshot(dom.window.document.body.innerHTML);
				root.unmount();
			});
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

describe("misc tests", import.meta.url, (it) => {
	it("ref ordering", async () => {
		await wrapInDOMAsync(async (dom) => {
			let ref1: HTMLElement | null = null as HTMLElement | null;
			let ref2: HTMLElement | null = null as HTMLElement | null;
			let acceptRef1 = (value: HTMLElement | null) => (ref1 = value);
			let acceptRef2 = (value: HTMLElement | null) => (ref2 = value);

			const root = createRoot(
				dom.window.document.body,
				<div>
					<div id="1" ref={acceptRef1}></div>
					<div id="2" ref={acceptRef2}></div>
				</div>
			);
			assert.equal(ref1?.id, "1");
			assert.equal(ref2?.id, "2");
			await root.render(
				<div>
					<div id="1" ref={acceptRef2}></div>
					<div id="2" ref={acceptRef1}></div>
				</div>
			);
			assert.equal(ref1?.id, "2");
			assert.equal(ref2?.id, "1");
		});
	});
	it("array edge case", async () => {
		await wrapInDOMAsync(async (dom) => {
			const root = createRoot(
				dom.window.document.body,
				<span>
					a<span>{[]}</span>a
				</span>
			);
			assert.equal(dom.window.document.body.textContent, "aa");
			await root.render(
				<span>
					b<span>{[]}</span>b
				</span>
			);
			assert.equal(dom.window.document.body.textContent, "bb");
			await root.render(
				<span>
					c<span>{[]}</span>c
				</span>
			);
			assert.equal(dom.window.document.body.textContent, "cc");
			root.unmount();
		});
	});
});
