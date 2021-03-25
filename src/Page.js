let chokidar = require("chokidar");
let fs = require("flowfs");
let url = require("url");
let cmd = require("./utils/cmd");
let sleep = require("./utils/sleep");
let validIdentifier = require("./utils/validIdentifier");
let instantiateSsrModule = require("./utils/instantiateSsrModule");
let isElectron = require("./utils/isElectron");
let payload = require("./payload");

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
			config,
			scheduler,
			template,
			liveReload,
		} = engine;
		
		let {
			dir,
			buildDir,
			assetsPrefix,
		} = config;
		
		this.engine = engine;
		this.path = path;
		this.relativePath = fs(path).pathFrom(dir);
		this.name = validIdentifier(fs(path).basename);
		
		this.config = config;
		this.scheduler = scheduler;
		this.template = template;
		this.liveReload = liveReload;
		
		this.ready = false;
		
		let base = fs(path).reparent(dir, buildDir);
		
		this.buildFile = base.withExt(".json");
		this.jsPath = assetsPrefix + base.reExt(".js").pathFrom(buildDir);
		this.cssPath = assetsPrefix + base.reExt(".css").pathFrom(buildDir);
		
		this.active = false;
		
		if (this.liveReload) {
			this.liveReload.socket.on("connection", (ws) => {
				ws.setMaxListeners(0);
				
				ws.on("message", (path) => {
					if (path === this.path) {
						this.heartbeat();
					}
				});
			});
		}
	}
	
	runBuildScript() {
		let {
			name,
			path,
			config,
			buildFile,
		} = this;
		
		let {
			dir,
			buildScript,
		} = config;
		
		let json = JSON.stringify({
			name,
			path,
			buildPath: buildFile.path,
			config,
		});
		
		return cmd(`node ${buildScript} '${json}'`, json);
	}
	
	build() {
		let {promise, child: buildProcess} = this.runBuildScript();
		
		return {
			buildProcess,
			complete: promise,
		};
	}
	
	/**
	 * Init the page. If init is already in flight, the existing promise will be
	 * returned
	 * @param {*} priority - the priority of the build in the queue if needed
	 */
	async init(priority = false, force = false) {
		// this makes sure the page will only be initialized once since both page build
		// and engine init may initialize the page
		if (!this._initPromise) {
			this._initPromise = this.doInit(priority).then(() => {
				this._initPromise = undefined;
			});
		}
		return this._initPromise;
	}

	async doInit(priority=false) {
		if (!await this.buildFile.exists()) {
			await this.scheduler.scheduleBuild(this, priority);
		}
		
		try {
			let {
				client,
				server,
				hashes,
			} = await this.buildFile.readJson();
			
			this.serverComponent = server;
			this.clientComponent = client;
			this.hashes = hashes || {};
			
			if (this.serverComponent) {
				this.ssrModule = await instantiateSsrModule(this.serverComponent.component, this.path);
			}
		} catch (e) {
			this.buildFile.deleteIfExists();
			
			throw e;
		}
		
		if (this.config.watch) {
			if (this.watcher) {
				this.watcher.close();
			}
			
			this.watcher = chokidar.watch(this.clientComponent.watchFiles);
			
			this.watcher.on("change", async () => {
				this.ready = false;
				this.buildFile.deleteIfExists();
				
				if (this.active) {
					await this.scheduler.build(this);
				} else {
					await sleep(100);
					
					await this.scheduler.scheduleBuild(this);
				}
				this.init();
			});
			
			if (this.config.liveReload) {
				if (isElectron) {
					let {BrowserWindow} = require("electron");
					
					for (let win of BrowserWindow.getAllWindows()) {
						let winUrl = win.getURL();
						
						if (winUrl) {
							if (url.parse(winUrl).pathname === this.path) {
								win.webContents.reloadIgnoringCache();
							}
						}
					}
				} else {
					for (let client of this.liveReload.socket.clients) {
						client.send(this.path);
					}
				}
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
	
	async render(locals, forEmail=false) {
		if (locals._rebuild) {
			await this.scheduler.build(this);
		}
		
		if (!this.ready) {
			await this.init(true);
		}
		
		let _head = false; // HACK https://github.com/sveltejs/svelte/issues/4982
		
		locals = {
			__headOnce() {
				if (_head) {
					return false;
				}
				
				_head = true;
				
				return true;
			},
			
			...locals,
		};
		
		payload.set(locals);
		
		/*
		pre-render hook for setting/clearing stores
		*/
		
		if (this.config.prerender) {
			this.config.prerender(locals);
		}
		
		/*
		note that we don't use .css from render() - this only includes CSS for
		child components that happen to be rendered this time.  we use
		serverComponent.css, which has CSS for all components that are imported
		(ie all components that could possibly be rendered)
		*/
		
		let head = "";
		let html = "";
		let css = "";
		let js = "";
		
		if (this.config.ssr) {
			let module = this.ssrModule["default"] || this.ssrModule;
			
			try {
				({head, html} = module.render(locals));
			} catch (e) {
				if (this.config.env === "dev") {
					this.ready = false;
					this.buildFile.delete();
				}
				
				throw e;
			}
		}
		
		if (this.serverComponent) {
			({css} = this.serverComponent);
		}
		
		if (this.clientComponent) {
			({js} = this.clientComponent);
		}
		
		let json = JSON.stringify(locals);
		let props = json;
		
		if (this.config.payloadFormat === "templateString") {
			props = "`" + json.replace(/\\/g, "\\\\") + "`";
		}
		
		if (this.liveReload) {
			head += `
				<script>
					let socket;
					let sendErrors = 0;
					
					let storageKeys = {
						retries: "svelte-view-engine.websocketRetries",
					};
					
					function retry() {
						let retries = Number(sessionStorage.getItem(storageKeys.retries) || "0");
						
						if (retries > 2) {
							sessionStorage.setItem(storageKeys.retries, 0);
							
							console.error("svelte-view-engine live-reload: unable to establish WebSocket connection");
						} else {
							sessionStorage.setItem(storageKeys.retries, retries + 1);
							
							location.reload();
						}
					}
					
					function createSocket() {
						socket = new WebSocket("ws://" + location.hostname + ":${this.liveReload.port}");
						
						socket.addEventListener("open", function() {
							sessionStorage.setItem(storageKeys.retries, 0);
						});
						
						socket.addEventListener("message", function(message) {
							if (message.data === "${this.path}") {
								location.reload();
							}
						});
						
						socket.addEventListener("error", retry);
						socket.addEventListener("close", retry);
					}
					
					function heartbeat() {
						try {
							socket.send("${this.path}");
						} catch (e) {
							sendErrors++;
							
							if (sendErrors >= 3) {
								retry();
							}
						}
					}
					
					createSocket();
					
					setInterval(heartbeat, 1000);
				</script>
			`;
		}
		
		if (forEmail) {
			return html;
		} else {
			let {
				name,
				jsPath,
				cssPath,
			} = this;
			
			return this.template.render({
				head,
				html,
				css,
				js: js.code,
				jsPath,
				cssPath,
				jsHash: this.hashes.js,
				cssHash: this.hashes.css,
				name,
				props,
			});
		}
	}
}
