let _LCounter = 0;
const NodeMap = new WeakMap<HTMLElement, Node>();

/** Core wrapper for {@link HTMLElement DOM elements}. */
export class Node {
	wraps: HTMLElement;
	children: Node[] = [];
	readonly id: string = "L" + _LCounter++;
	/**
	 * Creates a node, wrapping an HTML element.
	 * @example new Node(document.createElement("h1"));
	 */
	constructor(wraps: HTMLElement) {
		this.wraps = wraps;
		this.wraps.id = this.id;
		NodeMap.set(this.wraps, this);
	}
	/** Adds a child node. Should not be overridden. */
	add(node: NodeEquivalent) {
		if (node != undefined) {
			let xnode: Node;
			if (typeof node === "string") {
				xnode = new Label(node);
			} else {
				xnode = node;
			}
			this.children.push(xnode);
			this.wraps.appendChild(xnode.wraps);
		} else {
			throw new Error("node undefined");
		}
		return this;
	}
	/** Works similarly to {@link add}, but takes multiple nodes and is the one you would want to override.
	 * (which is discouraged but yk) */
	with(...nodes: NodeEquivalent[]) {
		nodes.forEach((x) => {
			this.add(x);
		});
		return this;
	}
	/** Removes a child node in the same way {@link add} does. */
	delete(node: Node) {
		const idx = this.children.indexOf(node);
		if (idx < 0) {
			throw new Error(`Node ${node.id} not found.`);
		}
		this.children.splice(idx, 1);
		this.wraps.removeChild(node.wraps);
	}
	/** Removes one or more child nodes, like {@link with} does adding them. */
	remove(...nodes: Node[]) {
		nodes.forEach((x) => {
			this.delete(x);
		});
	}
	/** Conveniently chain-able callback thing for styling your nodes.
	 * @example new Label("This is a label!").style((s)=>{s.color="maroon";}) */
	style(fn: (style: CSSStyleDeclaration) => void) {
		fn(this.wraps.style);
		return this;
	}
	/** Adds a CSS class to your node.
	 * @example new Container().class("my-class") */
	class(cls: string) {
		this.wraps.classList.add(cls);
		return this;
	}
	get classes(): string[] {
		return [...this.wraps.classList];
	}
	/** Hopefully, this points at the parent element. */
	get parent(): Node | undefined {
		if (this.wraps.parentElement == null) return undefined;
		return NodeMap.get(this.wraps.parentElement);
	}
	x(worker: (self: Node) => void): Node {
		worker(this);
		return this;
	}

	protected serverRenderChildren(): string {
		return this.children
			.map((child) => {
				return child.serverRender();
			})
			.join("");
	}
	protected serverRenderBaseAttributes(): string {
		const otherOut: string[] = [];
		//otherOut.push(`id="${this.id}"`)
		if (this.classes.length > 0) {
			otherOut.push(`class="${this.classes.join(" ")}"`);
		}
		if (this.wraps.style.cssText != "") {
			otherOut.push(`style="${this.wraps.style.cssText}"`);
		}
		return otherOut.join(" ");
	}
	/** Renders out this node and its children to an HTML string.
	 *
	 * **`import "@/domlink_server.ts";` needs be placed before your DomLink import.**
	 *
	 * Limitations to be aware of:
	 *  - Interactive elements such as {@link Button} or {@link Input} will not be functional.
	 *  - External CSS files are preferred, but if you have to,
	 *    `wraps.style.cssText` is the only way to style a {@link Node} inline.
	 */
	protected serverRender(): string {
		const result = `<${this.wraps.tagName} ${this.serverRenderBaseAttributes()}>${this.serverRenderChildren()}</${this.wraps.tagName}>`;
		_LCounter = 0;
		return result;
	}
}
type NodeEquivalent = Node | string;
enum LinkTarget {
	THIS_TAB = "_this",
	NEW_TAB = "_blank",
	OUT_FRAME = "_parent",
	NOT_FRAME = "_top",
}
/** Wrapper for {@link HTMLAnchorElement `<a>`} */
export class Link extends Node {
	constructor(around: NodeEquivalent | null) {
		const a = document.createElement("a");
		a.classList.add("LLink");
		super(a);
		if (around != null) {
			this.add(around);
		}
	}
	set destination(x: string) {
		(this.wraps as HTMLAnchorElement).href = x;
	}
	// noinspection JSUnusedGlobalSymbols
	get destination(): string {
		return (this.wraps as HTMLAnchorElement).href;
	}
	set target(x: string) {
		(this.wraps as HTMLAnchorElement).target = x;
	}
	get target(): string {
		return (this.wraps as HTMLAnchorElement).target;
	}
	to(dst: string, tgt: LinkTarget = LinkTarget.NEW_TAB) {
		this.destination = dst;
		this.target = tgt;
		return this;
	}
	protected override serverRender() {
		return `<a href="${this.destination}" ${this.target != "" ? `target="${this.target}"` : ""}>${this.serverRenderChildren()}</a>`;
	}
}
/** Wrapper for {@link HTMLDivElement `<div>`} w/ methods to set up a d/d target */
export class Container extends Node {
	constructor() {
		const div = document.createElement("div");
		div.classList.add("LContainer");
		super(div);
	}
	draggable(type: string, data: string) {
		this.wraps.draggable = true;
		this.wraps.ondragstart = (e) => {
			if (e.dataTransfer) {
				e.dataTransfer.setData(type, data);
			}
		};
		return this;
	}
	droppable(type: string, handler: (e: DragEvent) => void) {
		this.wraps.ondragover = (e) => e.preventDefault(); // allow drop
		this.wraps.ondrop = (e) => {
			e.preventDefault();
			handler(e);
		};
	}
}

/** Vertical Flexbox container */
export class Column extends Container {
	constructor() {
		super();
		this.wraps.classList.add("LColumn");
	}
}
/** Horizontal Flexbox container */
export class Row extends Container {
	constructor() {
		super();
		this.wraps.classList.add("LRow");
	}
}
/** Wrapper for {@link HTMLTableElement `<table>`} */
export class Table extends Node {
	constructor() {
		const table = document.createElement("table");
		table.classList.add("LTable");
		super(table);
	}
}
/** Wrapper for {@link HTMLTableRowElement `<tr>`} */
export class TableRow extends Node {
	constructor() {
		const tr = document.createElement("tr");
		tr.classList.add("LTableRow");
		super(tr);
	}
}
/** Wrapper for {@link HTMLTableCellElement `<td>`} */
export class TableCell extends Node {
	constructor() {
		const td = document.createElement("td");
		td.classList.add("LTableCell");
		super(td);
	}
}
/** An "abstract" class of sorts for {@link HTMLElement}s that have a textContent member.*/
export class Text extends Node {
	private _text: string = "";
	get text() {
		return this._text;
	}
	set text(x) {
		this._text = x;
		this.wraps.textContent = x;
	}
	/** A raw text node is used as a literal string of text in this context */
	protected override serverRender(): string {
		return this.text;
		//return `<${this.wraps.tagName} ${this.serverRenderBaseAttributes()}>${this.text}</${this.wraps.tagName}>`;
	}
}
/** Wrapper for {@link HTMLSpanElement `<span>`} */
export class Label extends Text {
	constructor(text: string = "") {
		const el = document.createElement("span");
		el.classList.add("LLabel");
		super(el);
		this.text = text;
	}
}
/** Wrapper for {@link HTMLButtonElement `<button>`} */
export class Button extends Text {
	constructor(label: string, action: EventListener, asLink: boolean = false) {
		const btn = document.createElement(asLink ? "a" : "button");
		if (asLink) btn.classList.add("LBtnLink");
		btn.textContent = label;
		btn.addEventListener("click", action);
		btn.classList.add("LButton");
		super(btn);
		this.text = label;
	}
}
/** Interface providing {@link Updatable.watch} */
interface Updatable<T> {
	/** Takes a callback `watcher` that is called when something like a text input is updated. */
	watch: (watcher: (newValue: T) => void) => void;
}
export class Input extends Text implements Updatable<string> {
	constructor(type: HTMLInputElement["type"] = "text") {
		const el = document.createElement("input");
		el.type = type;
		el.classList.add("LInput");
		super(el);
	}
	set placeholder(x: string) {
		(this.wraps as HTMLInputElement).placeholder = x;
	}
	get value(): string {
		return (this.wraps as HTMLInputElement).value;
	}
	set value(x: string) {
		(this.wraps as HTMLInputElement).value = x;
		this.watching.forEach((y) => y(x));
	}

	watching: ((newValue: string) => void)[] = [];
	/** Implementation for {@link Updatable.watch} */
	watch(watcher: (newValue: string) => void) {
		this.watching.push(watcher);
		this.wraps.oninput = () => {
			watcher(this.value);
		};
		watcher(this.value);
	}
}
/** Wrapper for {@link HTMLImageElement `<img>`} */
export class Image extends Node {
	constructor(src: string) {
		const img = document.createElement("img");
		img.src = src;
		img.classList.add("LImage");
		super(img);
	}
	protected override serverRender(): string {
		return `<${this.wraps.tagName} ${this.serverRenderBaseAttributes()} src="${(this.wraps as HTMLImageElement).src}">`;
	}
}
/** Wrapper for {@link HTMLDialogElement `<dialog>`} with methods to show/hide it as a modal. */
export class Modal extends Node {
	constructor() {
		const dlg: HTMLDialogElement = document.createElement("dialog");
		dlg.classList.add("LModal");
		super(dlg);
	}
	/** Shows the dialog as a modal. */
	show() {
		Body.add(this);
		(this.wraps as HTMLDialogElement).showModal();
	}
	/** Hides the dialog. */
	hide() {
		(this.wraps as HTMLDialogElement).close();
		Body.wraps.removeChild(this.wraps);
	}
}

export const Head = new Node(document.head);
// a stroke of genius!
class _Environment {
	loadStylesheet(path: string) {
		const style = document.createElement("link");
		style.rel = "stylesheet";
		style.href = path;
		const node = new Node(style);
		Head.with(node);
		return node;
	}
	private knownTitle: Text | null = null;
	set title(newTitle: string) {
		if (!this.knownTitle) {
			const found = Head.children.find((n) => n.wraps.tagName == "title");
			if (found) {
				this.knownTitle = found as Text;
			} else {
				this.knownTitle = new Text(document.createElement("title"));
			}
		}
		this.knownTitle.text = newTitle;
	}
}
export const Environment = new _Environment();

/** Convenience wrapper for the {@link HTMLBodyElement body} of the document. */
export const Body = new Node(document.body);
