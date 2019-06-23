let chokidar = require("chokidar");
let fs = require("flowfs");

/*
this is the root template that's used to render all pages.

it uses a simple template language with the following replacements:

${head} - svelte:head markup from SSR
${html} - component markup from SSR
${css} - component CSS {code, map}
${js} - component JS as "var ${name} = function..."
${name} - the component name used in the var declaration above, e.g. Page
${locals} - a JSON-stringified object of props to render

the Pages call the Template to render themselves, passing in methods to handle
each placeholder and also raw() to handle the non-placeholder sections of the
template file, e.g. in Page:

render() {
	this.template.render({
		head() {
			res.send(this.head);
		},
		
		raw(content) {
			res.send(content);
		},
		
		// etc
	});
}
*/

module.exports = class {
	constructor(path, options) {
		this.path = path;
		this.ready = false;
		this.sections = [];
		
		if (options.watch) {
			chokidar.watch(path).on("change", () => {
				this.ready = false;
			});
		}
		
		this.load();
	}
	
	async load() {
		let str = await fs(this.path).read();
		let placeholderRe = /\$\{\w+\}/g;
		
		let matches = str.match(placeholderRe);
		let otherParts = str.split(placeholderRe);
		
		for (let i = 0; i < otherParts.length; i++) {
			this.sections.push({
				type: "raw",
				content: otherParts[i],
			});
			
			let placeholder = matches.shift();
			
			if (placeholder) {
				this.sections.push({
					type: placeholder.replace(/[${}]/g, ""),
				});
			}
		}
		
		this.ready = true;
	}
	
	async render(fns) {
		if (!this.ready) {
			await this.load();
		}
		
		for (let section of this.sections) {
			if (!(section.type in fns)) {
				throw new Error(`Template - no render function defined for placeholder '${section.type}'`);
			}
			
			fns[section.type](section.content);
		}
	}
}
