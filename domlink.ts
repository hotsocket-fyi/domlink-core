//@ts-check
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
	add(node: NodeEquivalent): this {
		if (node != undefined) {
			let xnode: Node | Label;
			if (typeof node === "string") {
				// why i can't just smash `as Node` in here, i don't know.
				xnode = new Label(node);
			} else {
				xnode = node;
			}
			this.children.push(xnode as Node);
			this.wraps.appendChild(xnode.wraps);
		} else {
			throw new Error("node undefined");
		}
		return this;
	}
	/** Works similarly to {@link add}, but takes multiple nodes and is the one you would want to override.
	 * (which is discouraged but yk) */
	with(...nodes: NodeEquivalent[]): this {
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
	style(fn: (style: CSSStyleDeclaration) => void): this {
		fn(this.wraps.style);
		return this;
	}
	/** Adds a CSS class to your node.
	 * @example new Container().class("my-class") */
	class(cls: string): this {
		this.wraps.classList.add(cls);
		return this;
	}
	/** Returns the wrapped element's classList as an array. */
	getClasses(): string[] {
		return [...this.wraps.classList];
	}
	/** Gets the parent node.
	 * @returns Returns `undefined` if either the node has no parent, or the wrapped element's parent is not a node.
	 */
	getParent(): Node | undefined {
		if (this.wraps.parentElement == null) return undefined;
		return NodeMap.get(this.wraps.parentElement);
	}

	/** Helper similar to {@link style} that feeds your callback the node itself. */
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
		const classes = this.getClasses();
		if (classes.length > 0) {
			otherOut.push(`class="${classes.join(" ")}"`);
		}
		if (this.wraps.style.cssText != "") {
			otherOut.push(`style="${this.wraps.style.cssText}"`);
		}
		return otherOut.join(" ");
	}
	/** Renders out this node and its children to an HTML string.
	 *
	 * **`import "jsr:@domlink/headless";` needs be placed before your DomLink import.**
	 *
	 * Limitations to be aware of:
	 *  - Interactive elements such as {@link Button} or {@link Input} will not be functional.
	 *  - External CSS files are preferred, but if you have to,
	 *    `wraps.style.cssText` is the only way to style a {@link Node} inline.
	 */
	serverRender(): string {
		const result =
			`<${this.wraps.tagName} ${this.serverRenderBaseAttributes()}>${this.serverRenderChildren()}</${this.wraps.tagName}>`;
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
	setDestination(x: string) {
		(this.wraps as HTMLAnchorElement).href = x;
	}
	// noinspection JSUnusedGlobalSymbols
	getDestination(): string {
		return (this.wraps as HTMLAnchorElement).href;
	}
	setTarget(x: string) {
		(this.wraps as HTMLAnchorElement).target = x;
	}
	getTarget(): string {
		return (this.wraps as HTMLAnchorElement).target;
	}
	to(dst: string, tgt: LinkTarget = LinkTarget.NEW_TAB): this {
		this.setDestination(dst);
		this.setTarget(tgt);
		return this;
	}
	override serverRender(): string {
		const destination = this.getDestination();
		const target = this.getTarget();
		return `<a href="${destination}" ${
			target != "" ? `target="${target}"` : ""
		}>${this.serverRenderChildren()}</a>`;
	}
}
/** Wrapper for {@link HTMLDivElement `<div>`} w/ methods to set up a d/d target */
export class Container extends Node {
	constructor() {
		const div = document.createElement("div");
		div.classList.add("LContainer");
		super(div);
	}
	draggable(type: string, data: string): this {
		this.wraps.draggable = true;
		this.wraps.ondragstart = (e) => {
			if (e.dataTransfer) {
				e.dataTransfer.setData(type, data);
			}
		};
		return this;
	}
	droppable(type: string, handler: (e: DragEvent) => void): this {
		this.wraps.ondragover = (e) => e.preventDefault(); // allow drop
		this.wraps.ondrop = (e) => {
			e.preventDefault();
			handler(e);
		};
		return this;
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
	protected _text: string = "";
	getText(): string {
		return this._text;
	}
	setText(x: string) {
		this._text = x;
		this.wraps.textContent = x;
	}
	/** A raw text node is used as a literal string of text in this context */
	override serverRender(): string {
		return this._text;
		//return `<${this.wraps.tagName} ${this.serverRenderBaseAttributes()}>${this.text}</${this.wraps.tagName}>`;
	}
}
/** Wrapper for {@link HTMLSpanElement `<span>`} */
export class Label extends Text {
	constructor(text: string = "") {
		const el = document.createElement("span");
		el.classList.add("LLabel");
		super(el);
		this.setText(text);
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
		this.setText(label);
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
	setPlaceholder(x: string) {
		(this.wraps as HTMLInputElement).placeholder = x;
	}
	getValue(): string {
		return (this.wraps as HTMLInputElement).value;
	}
	setValue(x: string) {
		(this.wraps as HTMLInputElement).value = x;
		this.watching.forEach((y) => y(x));
	}

	watching: ((newValue: string) => void)[] = [];
	/** Implementation for {@link Updatable.watch} */
	watch(watcher: (newValue: string) => void) {
		this.watching.push(watcher);
		this.wraps.oninput = () => {
			watcher(this.getValue());
		};
		watcher(this.getValue());
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
	override serverRender(): string {
		return `<${this.wraps.tagName} ${this.serverRenderBaseAttributes()} src="${
			(this.wraps as HTMLImageElement).src
		}">`;
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

class Title extends Text {
	override serverRender(): string {
		return `<title>${this._text}</title>`;
	}
}

/** Wrapper for {@link HTMLLinkElement `<link>`} */
export class Reference extends Text {
	private rel: string;
	private href: string;
	constructor(rel: string, href: string) {
		super(document.createElement("link"));
		(this.wraps as HTMLLinkElement).rel = rel;
		(this.wraps as HTMLLinkElement).href = href;
		this.rel = rel;
		this.href = href;
	}
	override serverRender(): string {
		return `<link rel="${this.rel}" href="${this.href}">`;
	}
}

export const Head: Node = new Node(document.head);

/** Class containing document helper functions */
export class Environment {
	/** Creates a link element and points it at a specified stylesheet. */
	static useStylesheet(path: string): Node {
		const node = new Reference("stylesheet", path);
		Head.with(node);
		return node;
	}
	private static knownTitle: Title | null = null;
	/** Creates a title element if necessary, and sets its content to `newTitle`. */
	static setTitle(newTitle: string) {
		if (!this.knownTitle) {
			const found = Head.children.find((n) => n.wraps.tagName == "title");
			if (found) {
				this.knownTitle = found as Title;
			} else {
				this.knownTitle = new Title(document.createElement("title"));
				Head.with(this.knownTitle);
			}
		}
		this.knownTitle.setText(newTitle);
	}
	/** Renders head, body inside HTML tags out to a string. */
	static serverRender(): string {
		const ret = `<html>${Head.serverRender()}${Body.serverRender()}</html>`;
		_LCounter = 0;
		return ret;
	}
}

/** Convenience wrapper for the {@link HTMLBodyElement body} of the document. */
export const Body: Node = new Node(document.body);
