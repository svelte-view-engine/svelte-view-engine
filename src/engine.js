let os = require("os");
let ws = require("ws");
let fs = require("flowfs");
let Page = require("./Page");
let Template = require("./Template");
let buildScheduler = require("./buildScheduler");

module.exports = function(opts={}) {
	let dev = process.env.NODE_ENV !== "production";
	
	let options = Object.assign({
		dir: null,
		type: "html",
		init: true,
		buildConcurrency: os.cpus().length,
		template: null,
		buildScript: null,
		buildDir: null,
		watch: dev,
		liveReload: dev,
		liveReloadPort: 5000 + Math.floor(Math.random() * 60535),
		transpile: !dev,
		minify: !dev,
		verbose: true,
		excludeLocals: [
			"_locals",
			"settings",
			"cache",
		],
		dev,
	}, opts);
	
	let template = new Template(options.template, {
		watch: options.watch,
	});
	
	let scheduler = buildScheduler(options);
	let liveReloadSocket;
	let pages = {};
	
	if (options.liveReload) {
		liveReloadSocket = new ws.Server({
			port: options.liveReloadPort,
		});
		
		// remove default EventEmitter limit
		liveReloadSocket.setMaxListeners(0);
	}
	
	function createPage(path) {
		return new Page(
			scheduler,
			template,
			path,
			options,
			liveReloadSocket,
		);
	}
	
	async function prebuild() {
		let files = await fs(options.dir).glob("**/*." + options.type);
		
		for (let node of files) {
			let page = createPage(node.path);
			
			pages[node.path] = page;
			
			scheduler.scheduleBuild(page);
		}
	}
	
	if (options.init) {
		prebuild();
	}
	
	return {
		dir: options.dir,
		type: options.type,
		
		/*
		bit of a hacky inclusion for watching/restarting the app server in dev
		
		we want to make sure the page build is done before restarting in case
		the dep triggers both a page rebuild and an app restart, otherwise
		the app will restart before the page gets a chance to rebuild
		*/
		
		async awaitPendingBuilds() {
			await scheduler.awaitPendingBuilds();
		},
		
		async render(path, locals, callback) {
			let sendLocals = {};
			
			if (!pages[path]) {
				pages[path] = createPage(path);
			}
			
			let page = pages[path];
			
			for (let p in locals) {
				if (!options.excludeLocals.includes(p)) {
					sendLocals[p] = locals[p];
				}
			}
			
			try {
				let result = await page.render(sendLocals);
				
				if (callback) {
					callback(null, result);
				} else {
					return result;
				}
			} catch (e) {
				
				if (callback) {
					callback(e);
				} else {
					throw e;
				}
			}
		},
	}
}
