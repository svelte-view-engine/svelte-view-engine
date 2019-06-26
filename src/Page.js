let chokidar = require("chokidar");
let fs = require("flowfs");
let buildSsrComponent = require("./buildSsrComponent");
let buildDomComponent = require("./buildDomComponent");
let payload = require("./payload");

/*
this represents a component.  it caches the build artifacts and watches
for changes.

the render() method returns a string containing the complete HTML for the page,
which can be passed directly back to express.

Template placeholders used:

${head} - svelte:head markup from SSR
${html} - component markup from SSR
${css} - component CSS
${js} - component JS as "var ${name} = function..."
${name} - the component name used in the var declaration above
${props} - a JSON-stringified object of props to render
*/

module.exports = class {
	constructor(template, path, options) {
		this.template = template;
		this.path = path;
		this.options = options;
		this.name = fs(path).basename;
		this.ready = false;
		this.pendingBuild = null;
		this.cachedBundles = {};
		
		this.build();
	}
	
	async _build() {
		this.serverComponent = await buildSsrComponent(this.path, this.options, this.cachedBundles.server);
		this.clientComponent = await buildDomComponent(this.path, this.options, this.cachedBundles.client);
		this.cachedBundles.server = this.serverComponent.cache;
		this.cachedBundles.client = this.clientComponent.cache;
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
			this.prerenderedServerComponent = this.serverComponent.component.render();
		}
		
		this.pendingBuild = null;
		this.ready = true;
	}
	
	async render(locals) {
		if (!this.ready) {
			await this.build();
		}
		
		// set the payload; render; then unset
		// the payload is global (!) -- this is required to get access to the current
		// value from within the compiled serverside component, and also to make the
		// same module (./payload) work for both server- and client-side code.
		
		payload.set(locals);
		
		let {head, html, css} = (
			this.options.useLocalsForSsr
			? this.serverComponent.component.render(locals)
			: this.prerenderedServerComponent
		);
		
		payload.set(null);
		
		let {js} = this.clientComponent;
		
		let str = "";
		let props = JSON.stringify(locals);
		
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
			
			props: () => {
				str += props;
			},
		});
		
		return str;
	}
}
