let buildComponent = require("./buildComponent");
let chokidar = require("chokidar");
let fs = require("flowfs");

/*
this represents a component.  it caches the build artifacts and watches
for changes.

the render() method returns a string containing the complete HTML for the page,
which can be passed directly back to express.

TODO use Buffers or Streams if Express supports them, instead of strings
*/

module.exports = class {
	constructor(template, path, watch) {
		this.template = template;
		this.path = path;
		this.name = fs(path).basename;
		this.ready = false;
		
		if (watch) {
			chokidar.watch(path).on("change", () => {
				this.ready = false;
			});
		}
		
		this.build();
	}
	
	async build() {
		this.component = await buildComponent(this.path);
		this.ready = true;
	}
	
	async render(locals) {
		if (!this.ready) {
			await this.build();
		}
		
		let str = "";
		
		this.template.render({
			raw: (content) => {
				str += content;
			},
			
			head: () => {
				str += this.component.head;
			},
			
			html: () => {
				str += this.component.html;
			},
			
			css: () => {
				str += this.component.css.code;
				// TODO map
			},
			
			js: () => {
				str += this.component.js.code;
				// TODO map
			},
			
			name: () => {
				str += this.name;
			},
			
			locals: () => {
				str += JSON.stringify(locals);
			},
		});
		
		return str;
	}
}
