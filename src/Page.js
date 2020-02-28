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

this defines how long after the last websocket hearbeat to consider a page
no longer active
*/

let idleTimeout = 1000 * 15;

module.exports = class {
	constructor(engine, path) {
		let {
			options,
			scheduler,
			template,
			liveReloadSocket,
		} = engine;
		
		this.engine = engine;
		this.path = path;
		this.relativePath = fs(path).pathFrom(options.dir);
		this.name = validIdentifier(fs(path).basename);
		
		this.options = options;
		this.scheduler = scheduler;
		this.template = template;
		this.liveReloadSocket = liveReloadSocket;
		
		this.ready = false;
		this.buildFile = fs(path).reparent(options.dir, options.buildDir).withExt(".json");
		
		this.active = false;
		
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
	
	async runBuildScript(useCache) {
		let json = {
			name: this.name,
			path: this.path,
			buildPath: this.buildFile.path,
			useCache,
			options: this.options,
		};
		
		await cmd(`
			js
			${this.options.buildScript}
			'${JSON.stringify(json)}'
		`);
	}
	
	async build(options) {
		let {
			useCache,
		} = Object.assign({
			useCache: false,
		}, options);
		
		await this.runBuildScript(useCache);
		await this.init();
	}
	
	async init(priority=false) {
		if (!await this.buildFile.exists()) {
			return this.scheduler.build(this, priority);
		}
		
		try {
			let {
				client,
				server,
			} = await this.buildFile.readJson();
			
			this.serverComponent = server;
			this.clientComponent = client;
			
			this.ssrModule = await instantiateSsrModule(this.serverComponent.component, this.path);
		} catch (e) {
			this.buildFile.delete();
			
			throw e;
		}
		
		if (this.options.watch) {
			if (this.watcher) {
				this.watcher.close();
			}
			
			this.watcher = chokidar.watch(this.clientComponent.watchFiles);
			
			this.watcher.on("change", async (path) => {
				let useCache = !noCacheDependencyTypes.includes(fs(path).type);
				
				this.ready = false;
				
				if (!this.active) {
					// give active pages a chance to get scheduled first
					await sleep(100);
				}
				
				this.scheduler.scheduleBuild(this, this.active, {
					useCache,
				});
			});
		}
		
		if (this.liveReloadSocket) {
			for (let client of this.liveReloadSocket.clients) {
				client.send(this.path);
			}
		}
		
		this.ready = true;
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
		try {
			if (locals._rebuild) {
				await this.build();
			}
			
			if (!this.ready) {
				if (!this.options.renderBeforeInit) {
					await this.engine._init;
				}
				
				await this.init(true);
			}
			
			/*
			set the payload; render; then unset
			
			the payload is global -- this is required to get access to the current
			value from within the compiled serverside component, and also to make the
			same module (./payload) work for both server- and client-side code.
			*/
			
			payload.set(locals);
			
			/*
			Clear stores
			*/
			
			if (this.options.stores) {
				for (let store of this.options.stores) {
					if (store.reset) {
						store.reset();
					} else {
						store.set(undefined);
					}
				}
			}
			
			/*
			note that we don't use .css from render() - this only includes CSS for
			child components that happen to be rendered this time.  we use
			serverComponent.css, which has CSS for all components that are imported
			(ie all components that could possibly be rendered)
			*/
			
			let {head, html} = this.ssrModule.render(locals);
			let {css} = this.serverComponent;
			let {js} = this.clientComponent;
			
			let json = JSON.stringify(locals);
			let props = json;
			
			if (this.options.payloadFormat === "templateString") {
				props = "`" + json.replace(/\\/g, "\\\\") + "`";
			}
			
			if (this.liveReloadSocket) {
				head += `
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
			
			return await this.template.render({
				head,
				html,
				css: css.code,
				js: js.code,
				name: this.name,
				props,
			});
		} catch (e) {
			if (this.options.rebuildOnRenderError) {
				/*
				for dev - just means we can refresh the page as soon as
				we fix it after a 500 and it'll wait for the rebuild, so
				we don't have to keep refreshing and getting the 500
				until it's finished
				*/
				
				this.ready = false;
				this.buildFile.delete();
			}
			
			throw e;
		} finally {
			payload.set(null);
		}
	}
}
