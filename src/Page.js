let chokidar = require("chokidar");
let fs = require("flowfs");
let cmd = require("./utils/cmd");
let sleep = require("./utils/sleep");
let validIdentifier = require("./utils/validIdentifier");
let instantiateSsrModule = require("./utils/instantiateSsrModule");
let payload = require("./payload");

/*
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

/*
saving a .scss file that gets @imported into the .svelte <style>
triggers a rebuild, but for some reason doesn't use the new css
if using cached bundles
*/

let noCacheDependencyTypes = ["sass", "scss"];

/*
in dev, we want to know which pages we're currently looking at so we can
schedule them for priority rebuilding when a common dependency is changed

this defines how long after rendering to consider a page no longer active
*/

let idleTimeout = 1000 * 15;

module.exports = class {
	constructor(engine, template, path, options, liveReloadSocket) {
		this.engine = engine;
		this.template = template;
		this.path = path;
		this.relativePath = fs(path).pathFrom(options.dir);
		this.options = options;
		this.liveReloadSocket = liveReloadSocket;
		this.name = validIdentifier(fs(path).basename);
		this.active = false;
		
		this.ready = false;
		this.buildFile = fs(path).reparent(options.dir, options.buildDir).withExt(".json");
		
		if (this.liveReloadSocket) {
			this.liveReloadSocket.on("connection", (ws) => {
				ws.setMaxListeners(0);
				
				ws.on("message", (path) => {
					if (path === this.path) {
						this.heartbeat();
					}
				});
			});
		}
	}
	
	async runBuildScript(noCache=false) {
		let json = {
			name: this.name,
			path: this.path,
			buildPath: this.buildFile.path,
			noCache,
			options: this.options,
		};
		
		await cmd(`
			js
			${this.options.buildScript}
			'${JSON.stringify(json)}'
		`);
	}
	
	async build(rebuild, noCache) {
		try {
			if (rebuild || !await this.buildFile.exists()) {
				await this.runBuildScript(noCache);
			}
			
			let {
				client,
				server,
			} = await this.buildFile.readJson();
	
			this.serverComponent = server;
			this.clientComponent = client;
	
			this.ssrModule = await instantiateSsrModule(this.serverComponent.component, this.path);
			
			if (this.options.watch) {
				if (this.watcher) {
					this.watcher.close();
				}
				
				this.watcher = chokidar.watch(this.clientComponent.watchFiles);
				
				this.watcher.on("change", async (path) => {
					let noCache = noCacheDependencyTypes.includes(fs(path).type);
					
					this.ready = false;
					
					if (!this.active) {
						/*
						give active pages a chance to get scheduled early
						*/
						await sleep(100);
					}
					
					this.engine.scheduleBuild(this, this.active, true, noCache);
				});
			}
			
			if (this.options.liveReload) {
				for (let client of this.liveReloadSocket.clients) {
					client.send(this.path);
				}
			}
			
			this.ready = true;
		} catch (e) {
			this.buildFile.delete();
			
			throw e;
		}
	}
	
	heartbeat() {
		this.active = true;
		
		if (this.idleTimer) {
			clearTimeout(this.idleTimer);
		}
		
		this.idleTimer = setTimeout(() => {
			this.active = false;
			this.idleTimer = null;
		}, idleTimeout);
	}
	
	async render(locals) {
		if (locals._rebuild) {
			await this.engine.build(this, true, true);
		}
		
		if (!this.ready) {
			await this.engine.build(this);
		}
		
		/*
		set the payload; render; then unset
		
		the payload is global -- this is required to get access to the current
		value from within the compiled serverside component, and also to make the
		same module (./payload) work for both server- and client-side code.
		*/
		
		payload.set(locals);
		
		/*
		note that we don't use .css from render() - this only includes CSS for
		child components that happen to be rendered this time.  we use
		serverComponent.css which has CSS for all components that are imported
		(ie all components that could possibly be rendered)
		*/
		
		let head;
		let html;
		let css;
		
		try {
			({head, html} = this.ssrModule.render());
			({css} = this.serverComponent);
		} finally {
			payload.set(null);
		}
		
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
							var socket;
							
							function createSocket() {
								socket = new WebSocket("ws://" + location.hostname + ":${this.options.liveReloadPort}");
								
								socket.addEventListener("message", function(message) {
									if (message.data === "${this.path}") {
										location.reload();
									}
								});
								
								socket.addEventListener("close", function() {
									setTimeout(createSocket, 500);
								});
							}
							
							function heartbeat() {
								socket.send("${this.path}");
							}
							
							createSocket();
							
							setInterval(heartbeat, 1000);
						</script>
					`;
				}
			},
			
			html: () => {
				str += html;
			},
			
			css: () => {
				str += css.code;
			},
			
			js: () => {
				str += js.code;
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
