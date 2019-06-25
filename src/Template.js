let chokidar = require("chokidar");
let fs = require("flowfs");

/*
this is the root template that's used to render all pages.

it uses a simple template language where ${...} placeholder values result in the
named function from the supplied map of render functions being called, and
everything else (not inside ${}) results in the .raw function being called with
the substring.  the Template doesn't actually render anything itself, it just
calls the functions.

You can also ${include files/relative/to/the/template}.  These include directives
are processed, with the file contents being inserted in place of the directive,
prior to any rendering.
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
		
		// process include directives first
		
		let includeRe = /\$\{\s*include\s+([^\s}]+)\s*\}/;
		let match;
		
		while (match = includeRe.exec(str)) {
			str = str.replace(includeRe, await fs(this.path).parent.child(match[1]).read());
		}
		
		// then set up placeholder sections
		
		let placeholderRe = /\$\{\s*\w+\s*}/g;
		
		let matches = str.match(placeholderRe);
		let otherParts = str.split(placeholderRe);
		
		this.sections = [];
		
		for (let i = 0; i < otherParts.length; i++) {
			this.sections.push({
				type: "raw",
				content: otherParts[i],
			});
			
			let placeholder = matches.shift();
			
			if (placeholder) {
				this.sections.push({
					type: placeholder.replace(/[${}\s]/g, ""),
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
