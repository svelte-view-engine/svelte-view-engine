let os = require("os");
let ws = require("ws");
let fs = require("flowfs");
let Page = require("./Page");
let Template = require("./Template");

function remove(array, item) {
	let index;
	
	while ((index = array.indexOf(item)) !== -1) {
		array.splice(index, 1);
	}
}

module.exports = function(opts={}) {
	let dev = process.env.NODE_ENV !== "production";
	
	let options = Object.assign({
		dir: null,
		type: "html",
		init: true,
		buildConcurrency: os.cpus().length,
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
		
		liveReloadSocket.setMaxListeners(0);
	}
	
	let pages = {};
	let inProgressBuilds = [];
	let buildQueue = [];
	
	let template = new Template(options.template, {
		watch: options.watch,
	});
	
	function checkQueue() {
		let toBuild = buildQueue.filter(function({page}) {
			return !inProgressBuilds.find(function(inProgressBuild) {
				return inProgressBuild.page === page;
			});
		}).slice(0, options.buildConcurrency - inProgressBuilds.length);
		
		if (toBuild.length > 0) {
			console.log("Building:");
		}
		
		for (let manifest of toBuild) {
			let {
				page,
				rebuild,
				noCache,
			} = manifest;
			
			console.log(
				"\t"
				+ page.relativePath
				+ (rebuild ? " (rebuild)" : "")
				+ (noCache ? " (no cache)" : "")
			);
			
			remove(buildQueue, manifest);
			
			let inProgressBuild = {
				page,
				
				promise: page.build(rebuild, noCache).then(function() {
					console.log("Page " + page.relativePath + " finished, checking queue");
					remove(inProgressBuilds, inProgressBuild);
					checkQueue();
				}, function() {
					console.log("Page " + page.relativePath + " errored, checking queue");
					remove(inProgressBuilds, inProgressBuild);
					checkQueue();
				}),
			};
			
			inProgressBuilds.push(inProgressBuild);
		}
	}
	
	function scheduleBuild(page, priority, rebuild, noCache) {
		let manifest = {
			page,
			rebuild,
			noCache,
		};
		
		console.log(
			"Scheduling "
			+ page.relativePath
			+ (priority ? " (priority)" : "")
			+ (rebuild ? " (rebuild)" : "")
			+ (noCache ? " (no cache)" : "")
		);
		
		if (priority) {
			buildQueue.unshift(manifest);
		} else {
			buildQueue.push(manifest);
		}
		
		checkQueue();
	}
	
	async function build(page, rebuild, noCache) {
		console.log(
			"Build immediate: "
			+ page.relativePath
			+ (rebuild ? " (rebuild)" : "")
			+ (noCache ? " (no cache)" : "")
		);
		
		buildQueue = buildQueue.filter(manifest => manifest.page !== page);
		
		let inProgressBuild = inProgressBuilds.find(b => b.page === page);
		
		if (inProgressBuild) {
			console.log("Awaiting in-progress build");
			
			await inProgressBuild.promise;
		}
		
		if (rebuild || !inProgressBuild) {
			console.log("Scheduling build");
			
			scheduleBuild(page, true, rebuild, noCache);
			
			while (!(inProgressBuild = inProgressBuilds.find(b => b.page === page))) {
				console.log("Waiting for build slot");
				
				await Promise.race(inProgressBuilds.map(b => b.promise));
			}
			
			console.log("Awaiting build");
			
			await inProgressBuild.promise;
			
			console.log("Build complete");
		}
	}
	
	function createPage(path) {
		return new Page(
			{
				scheduleBuild,
				build,
			},
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
			
			scheduleBuild(page);
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
			while (inProgressBuilds.length > 0) {
				await inProgressBuilds[0].promise;
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
