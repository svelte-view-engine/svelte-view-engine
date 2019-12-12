let ws = require("ws");
let fs = require("flowfs");
let Page = require("./Page");
let Template = require("./Template");

module.exports = function(opts={}) {
	let dev = process.env.NODE_ENV !== "production";
	
	let options = Object.assign({
		dir: null,
		type: "html",
		init: true,
		template: null,
		buildScript: null,
		watch: dev,
		liveReload: dev,
		liveReloadPort: 5000 + Math.floor(Math.random() * 60535),
		transpile: !dev,
		minify: !dev,
		excludeLocals: [
			"_locals",
			"settings",
			"cache",
		],
		dev,
	}, opts);
	
	let liveReloadSocket;
	
	if (options.liveReload) {
		liveReloadSocket = new ws.Server({
			port: options.liveReloadPort,
		});
	}
	
	let pages = {};
	
	let template = new Template(options.template, {
		watch: options.watch,
	});
	
	function createPage(path) {
		return new Page(template, path, options, liveReloadSocket);
	}
	
	async function prebuild() {
		let files = await fs(options.dir).glob("**/*." + options.type);
		
		for (let node of files) {
			let page = createPage(node.path);
			
			pages[node.path] = page;
			
			try {
				await page.build();
			} catch (e) {
				console.error("Error pre-building page " + path);
				console.error(e);
			}
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
			for (let path in pages) {
				if (pages[path].pendingBuild) {
					await pages[path].pendingBuild;
				}
			}
		},
		
		async render(path, locals, callback) {
			let sendLocals = {};
			
			for (let p in locals) {
				if (!options.excludeLocals.includes(p)) {
					sendLocals[p] = locals[p];
				}
			}
			
			if (!pages[path]) {
				pages[path] = createPage(path);
			}
			
			try {
				let result = await pages[path].render(sendLocals);
				
				if (callback) {
					callback(null, result);
				} else {
					return result;
				}
			} catch (e) {
				delete pages[path];
				
				if (callback) {
					callback(e);
				} else {
					throw e;
				}
			}
		},
	}
}
