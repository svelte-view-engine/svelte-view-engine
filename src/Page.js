let buildSsrComponent = require("./buildSsrComponent");
let buildDomComponent = require("./buildDomComponent");
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
		this.ServerComponent = await buildSsrComponent(this.path, this.options);
		this.clientComponent = await buildDomComponent(this.path, this.options);
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
			
			this.watcher = chokidar.watch(this.clientComponent.watchFiles);
			
			this.watcher.on("change", () => {
				this.ready = false;
			});
		}
		
		if (!this.options.useLocalsForSsr) {
			this.prerenderedServerComponent = this.ServerComponent.render();
		}
		
		this.pendingBuild = null;
		this.ready = true;
	}
	
	async render(locals) {
		if (!this.ready) {
			await this.build();
		}
		
		let head, html, css;
		
		if (this.options.useLocalsForSsr) {
			{head, html, css} = this.ServerComponent.render(locals);
		} else {
			{head, html, css} = this.prerenderedServerComponent;
		}
		
		let {js} = this.clientComponent;
		
		let str = "";
		
		await this.template.render({
			raw: (content) => {
				str += content;
			},
			
			head: () => {
				str += head;
			},
			
			html: () => {
				str += html;
			},
			
			css: () => {
				str += css.code;
				
				if (css.map) {
					str += css.map;
				}
			},
			
			js: () => {
				str += js.code;
				
				if (js.map) {
					str += js.map;
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
