import { describe } from "./snapshots";
import assert from "node:assert/strict";
import { createRoot } from "../root";
import { h } from "../createElement";
import type { OPC } from "../types";
import { wrapInDOMAsync } from "./util";
import { memo } from "../memo";

describe("memo", import.meta.url, (it) => {
	it("works", async () => {
		await wrapInDOMAsync(async (dom) => {
			let count = 0;
			const TestComponent: OPC<any> = () => {
				count++;
				return null;
			};
			const TestComponentMemo = memo(TestComponent);
			const root = createRoot(dom.window.document.body, null);
			await root.render(<TestComponentMemo dummy={0} />);
			assert.equal(count, 1);
			await root.render(<TestComponentMemo dummy={0} />);
			assert.equal(count, 1);
			await root.render(<TestComponentMemo dummy={1} />);
			assert.equal(count, 2);
			await root.render(<TestComponentMemo dummy={1} doomy={1} />);
			assert.equal(count, 3);
			await root.render(<TestComponentMemo dummy={1} />);
			assert.equal(count, 4);
			root.unmount();
		});
	});
	it("works with custom equal function", async () => {
		await wrapInDOMAsync(async (dom) => {
			let count = 0;
			const TestComponent: OPC<any> = () => {
				count++;
				return null;
			};
			let equalMock = true;
			const TestComponentMemo = memo(TestComponent, () => equalMock);
			const root = createRoot(dom.window.document.body, null);

			await root.render(<TestComponentMemo dummy={0} />);
			assert.equal(count, 1);
			await root.render(<TestComponentMemo dummy={0} />);
			assert.equal(count, 1);
			await root.render(<TestComponentMemo dummy={1} />);
			assert.equal(count, 1);
			await root.render(<TestComponentMemo dummy={1} doomy={1} />);
			assert.equal(count, 1);
			await root.render(<TestComponentMemo dummy={1} />);
			assert.equal(count, 1);

			equalMock = false;

			await root.render(<TestComponentMemo dummy={0} />);
			assert.equal(count, 2);
			await root.render(<TestComponentMemo dummy={0} />);
			assert.equal(count, 3);
			await root.render(<TestComponentMemo dummy={1} />);
			assert.equal(count, 4);
			await root.render(<TestComponentMemo dummy={1} doomy={1} />);
			assert.equal(count, 5);
			await root.render(<TestComponentMemo dummy={1} />);
			assert.equal(count, 6);

			root.unmount();
		});
	});
});
