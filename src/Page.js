let buildSsrComponent = require("./buildSsrComponent");
let buildDomComponent = require("./buildDomComponent");
let chokidar = require("chokidar");
let fs = require("flowfs");

/*
this represents a component.  it caches the build artifacts and watches
for changes.

the render() method returns a string containing the complete HTML for the page,
which can be passed directly back to express.
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
		
		let {head, html, css} = (
			this.options.useLocalsForSsr
			? this.ServerComponent.render(locals)
			: this.prerenderedServerComponent
		);
		
		let {js} = this.clientComponent;
		
		let str = "";
		
		await this.template.render({
			raw: (content) => {
				str += content;
			},
			
			head: () => {
				str += head;
				
				if (this.options.liveReload) {
					str += `\n<script src="http://livejs.com/live.js"></script>`;
				}
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
