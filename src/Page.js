let chokidar = require("chokidar");
let fs = require("flowfs");
let payload = require("./payload");
let validIdentifier = require("./utils/validIdentifier");

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

let pathStartRe = /([A-Z]:|\/)/;

/*
saving a .scss file that gets @imported into the .svelte <style>
triggers a rebuild, but for some reason doesn't use the new css
if using cached bundles
*/

let noCacheDependencyTypes = ["sass", "scss"];

module.exports = class {
	constructor(template, path, options, liveReloadSocket) {
		this.template = template;
		this.path = path;
		this.options = options;
		this.name = validIdentifier(fs(path).basename);
		this.ready = false;
		this.pendingBuild = null;
		this.cachedBundles = {};
		this.liveReloadSocket = liveReloadSocket;
		
		this.build();
	}
	
	async _build(noCache) {
		let cache = noCache ? {} : this.cachedBundles;
		
		this.serverComponent = await this.options.componentBuilders.ssr(this.path, this.options, cache.server);
		this.clientComponent = await this.options.componentBuilders.dom(this.path, this.name, this.options, cache.client);
		this.cachedBundles.server = this.serverComponent.cache;
		this.cachedBundles.client = this.clientComponent.cache;
		
		if (this.options.watch) {
			if (this.watcher) {
				this.watcher.close();
			}
			
			this.watcher = chokidar.watch(this.clientComponent.watchFiles.map((path) => {
				/*
				some paths have markers from rollup plugins - strip these for watching
				some are also not absolute; these are also internal to rollup and can
				be stripped
				*/
				
				let start = path.match(pathStartRe);
				
				if (start) {
					return path.substr(start.index);
				} else {
					return false;
				}
			}).filter(Boolean));
			
			this.watcher.on("change", (path) => {
				let noCache = noCacheDependencyTypes.includes(fs(path).type);
				
				this.ready = false;
				this.build(noCache);
			});
		}
		
		if (this.options.liveReload) {
			for (let client of this.liveReloadSocket.clients) {
				client.send(this.name);
			}
		}
		
		this.ready = true;
	}
	
	async build(noCache) {
		if (noCache && this.pendingBuild) {
			await this.pendingBuild;
			
			this.pendingBuild = null;
		}
		
		if (!this.pendingBuild) {
			this.pendingBuild = this._build(noCache);
		}
		
		await this.pendingBuild;
	
		this.pendingBuild = null;
	}
	
	async render(locals) {
		if (!this.ready) {
			await this.build();
		}
		
		/*
		set the payload; render; then unset
		the payload is global -- this is required to get access to the current
		value from within the compiled serverside component, and also to make the
		same module (./payload) work for both server- and client-side code.
		*/
		
		payload.set(locals);
		
		let {head, html} = this.serverComponent.component.render(locals);
		let {css} = this.serverComponent;
		
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
					str += `
						<script>
							var socket = new WebSocket("ws://" + location.hostname + ":${this.options.liveReloadPort}");
							
							socket.addEventListener("message", function(message) {
								if (message.data === "${this.name}") {
									location.reload();
								}
							});
						</script>
					`;
				}
			},
			
			html: () => {
				str += html;
			},
			
			css: () => {
				str += css.code;
				
				// TODO data: url for inline source maps
				//if (css.map) {
				//	str += css.map;
				//}
			},
			
			js: () => {
				str += js.code;
				
				// TODO data: url for inline source maps
				//if (js.map) {
				//	str += js.map;
				//}
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
