import { describe as baseDescribe, it as baseIt, test } from "node:test";
import * as fs from "node:fs";

let activeFile = "";
let activeSuite = "";
let activeTest = "";
let activeIndex = 0;

export function describe(
	suiteName: string,
	location: string,
	suite: (it: (name: string, test: () => void | Promise<void>) => void) => void
) {
	activeFile = location;
	activeSuite = suiteName;
	function it(testName: string, test: () => void | Promise<void>) {
		activeTest = testName;
		activeIndex = 0;
		baseIt(testName, async () => {
			activeFile = location;
			activeSuite = suiteName;
			activeTest = testName;
			activeIndex = 0;
			await test();
		});
	}
	baseDescribe(suiteName, () => suite(it));
}

export function snapshot(value: any) {
	if (!activeFile.startsWith("file:///")) {
		throw new Error("Bad activeFile");
	}
	const pathParts = activeFile.slice(8).split("/");
	const testPath = pathParts.slice(0, -1).join("/");
	const testFileName = pathParts.slice(-1);

	const snapFilePath = testPath + "/__snapshots__/";
	const snapFileLocation = snapFilePath + testFileName + ".snap";

	let data: Record<string, Record<string, any[]>>;
	if (fs.existsSync(snapFileLocation)) {
		data = JSON.parse(fs.readFileSync(snapFileLocation, { encoding: "utf-8" }));
	} else {
		data = {};
	}
	const suiteData = (data[activeSuite] ??= {});
	const testData = (suiteData[activeTest] ??= []);
	testData[activeIndex] = value;

	if (!fs.existsSync(snapFilePath)) {
		fs.mkdirSync(snapFilePath);
	}
	fs.writeFileSync(snapFileLocation, JSON.stringify(data, null, "\t") + "\n", { encoding: "utf-8" });
	activeIndex++;
}
