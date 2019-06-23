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
	constructor(template, path, options) {
		this.template = template;
		this.path = path;
		this.options = options;
		this.name = fs(path).basename;
		this.ready = false;
		this.pendingBuild = null;
		
		this.build();
	}
	
	async _build() {
		this.component = await buildComponent(this.path, this.options);
	}
	
	async build() {
		if (!this.pendingBuild) {
			this.pendingBuild = this._build();
		}
		
		await this.pendingBuild;
		
		if (this.options.watch) {
			if (this.watcher) {
				this.watcher.close();
			}
			
			this.watcher = chokidar.watch(this.component.watchFiles);
			
			this.watcher.on("change", () => {
				this.ready = false;
			});
		}
		
		
		this.pendingBuild = null;
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
				
				if (this.component.css.map) {
					str += this.component.css.map;
				}
			},
			
			js: () => {
				str += this.component.js.code;
				
				if (this.component.js.map) {
					str += this.component.js.map;
				}
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
