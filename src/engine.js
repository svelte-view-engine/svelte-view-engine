let os = require("os");
let ws = require("ws");
let fs = require("flowfs");
let Bluebird = require("bluebird");
let Page = require("./Page");
let Template = require("./Template");
let buildScheduler = require("./buildScheduler");

module.exports = function(opts={}) {
	let dev = process.env.NODE_ENV !== "production";
	
	let options = Object.assign({
		dir: null,
		type: "html",
		init: false,
		build: false,
		buildConcurrency: os.cpus().length,
		template: null,
		payloadFormat: "json",
		buildScript: null,
		buildDir: null,
		watch: dev,
		liveReload: dev,
		liveReloadPort: 5000 + Math.floor(Math.random() * 60535),
		transpile: !dev,
		minify: !dev,
		saveJs: dev,
		verbose: true,
		excludeLocals: [
			"_locals",
			"settings",
			"cache",
		],
		dev,
		stores: null,
		rebuildOnRenderError: false,
	}, opts);
	
	let template = new Template(options.template, {
		watch: options.watch,
	});
	
	let scheduler = buildScheduler(options);
	let liveReloadSocket;
	let pages = {};
	
	if (options.watch && options.liveReload) {
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
	
	let pagesCreated = false;
	
	async function createPages() {
		if (pagesCreated) {
			return;
		}
		
		let files = await fs(options.dir).glob("**/*." + options.type);
		
		for (let node of files) {
			pages[node.path] = createPage(node.path);
		}
		
		pagesCreated = true;
	}
	
	let engine = {
		dir: options.dir,
		type: options.type,
		
		async awaitPendingBuilds() {
			await scheduler.awaitPendingBuilds();
		},
		
		hasPendingBuilds() {
			return scheduler.hasPendingBuilds();
		},
		
		async buildPages() {
			await createPages();
			
			for (let page of Object.values(pages)) {
				scheduler.scheduleBuild(page);
			}
			
			await scheduler.awaitPendingBuilds();
		},
		
		/*
		initialise pages (build if necessary)
		*/
		
		async initPages() {
			await createPages();
			
			await Bluebird.map(Object.values(pages), page => page.init());
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
	};
	
	if (options.build) {
		engine.buildPages();
	} else if (options.init) {
		engine.initPages();
	}
	
	return engine;
}
