# vdomk

This is an experimental React-like view layer. It's intended only as a research project
and shouldn't be considered production ready.

## Usage

Example Todos App:

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

	function onChange(ev: JSX.TargetedEvent<HTMLInputElement>) {
		text = ev.currentTarget.value;
		scheduleUpdate(instance);
	}
	function addTodo() {
		todos.push({ text, done: false });
		text = "";
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

	return () => (
		<>
			<input type="text" value={text} onInput={onChange} />
			<button type="button" disabled={!text} onClick={addTodo}>
				Make new Todo
			</button>
			{todos.map(({ text, done }, index) => (
				<Todo text={text} done={done} toggle={() => handleToggle(index)} remove={() => handleRemove(index)} />
			))}
		</>
	);
};

createRoot(document.body, <TodoApp />);
```

## What's up with the component model?

It's somewhat inspired by [Crank](https://crank.js.org/).
One-time setup goes in the first function, and then new props are accepted and rendered in the inner function.
Many uses of, `useCallback`, `useRef`, and `useState` can be replaced with just local variables in the top scope.
In lieu of `useMemo`, you can use a library like [Reselect](https://github.com/reduxjs/reselect) and call `createSelector` in the top scope.
