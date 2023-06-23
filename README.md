# vdomk

This is an experimental React-like view layer. It's intended only as a research project and shouldn't be used by anything.

## Usage

Todos example:

```typescript
import { h, Fragment, createRoot, TPC, OPC, scheduleUpdate } from "vdomk";

const Todo: OPC<{ text: string; done: boolean; toggle(): void; remove(): void }> = ({ text, done, toggle, remove }) => {
	return (
		<div>
			{text}
			<input type="checkbox" checked={done} onChange={toggle} />
			<button type="button" onClick={remove}>
				Remove me
			</button>
		</div>
	);
};

const TodoApp: TPC<{}> = (_, instance) => {
	let todos: { text: string; done: boolean }[] = [];
	let text = "";
	let input: HTMLInputElement | null = null;
	function refInput(el: HTMLInputElement | null) {
		input = el;
	}

	function onChange(ev: JSX.TargetedEvent<HTMLInputElement>) {
		text = ev.currentTarget.value;
	}
	function addTodo() {
		todos.push({ text, done: false });
		text = "";
		input!.value = ""; // Inputs are uncontrolled
		scheduleUpdate(instance);
	}
	function handleToggle(index: number) {
		todos[index].done = !todos[index].done;
		scheduleUpdate(instance);
	}
	function handleRemove(index: number) {
		todos.splice(index, 1);
		scheduleUpdate(instance);
	}

	return () => {
		return (
			<>
				<input type="text" value={text} onInput={onChange} ref={refInput} />
				<button type="button" onClick={addTodo}>
					Make new Todo
				</button>
				{todos.map(({ text, done }, index) => (
					<Todo
						text={text}
						done={done}
						toggle={() => handleToggle(index)}
						remove={() => handleRemove(index)}
					/>
				))}
			</>
		);
	};
};

const root = createRoot(document.getElementById("root")!);
root.render(<TodoApp />);
```

## What's up with the component model?

It's somewhat inspired by [Crank](https://crank.js.org/).
One-time setup goes in the first function, and then new props are accepted and rendered in the inner function.
Many uses of, `useCallback`, `useRef`, and `useState` can be replaced with just local variables in the top scope.
In lieu of `useMemo`, you can use a library like [Reselect](https://github.com/reduxjs/reselect) and call `createSelector` in the top scope.

## What's broken or not yet implemented?

-   No `key` handling
-   `hooks.effect` just calls `setTimeout`
-   Bugs, bugs, bugs
-   React-like Context
