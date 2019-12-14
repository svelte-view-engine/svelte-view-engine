let remove = require("./utils/remove");

/*
schedule builds and limit concurrency for:

- fast rebuilds in dev
- cpu utilisation
- memory efficiency
*/

module.exports = function(options) {
	let inProgressBuilds = [];
	let buildQueue = [];
	
	function log(...args) {
		if (options.verbose) {
			console.log(...args);
		}
	}
	
	function checkQueue() {
		let toBuild = buildQueue.filter(function({page}) {
			return !inProgressBuilds.find(function(inProgressBuild) {
				return inProgressBuild.page === page;
			});
		}).slice(0, options.buildConcurrency - inProgressBuilds.length);
		
		if (toBuild.length > 0) {
			log("Building:");
		}
		
		for (let manifest of toBuild) {
			let {
				page,
				rebuild,
				noCache,
			} = manifest;
			
			log(
				"\t"
				+ page.relativePath
				+ (rebuild ? " (rebuild)" : "")
				+ (noCache ? " (no cache)" : "")
			);
			
			remove(buildQueue, manifest);
			
			let inProgressBuild = {
				page,
				
				promise: page.build(rebuild, noCache).finally(function() {
					log("Page " + page.relativePath + " finished, checking queue");
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
		
		log(
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
		log(
			"Build next: "
			+ page.relativePath
			+ (rebuild ? " (rebuild)" : "")
			+ (noCache ? " (no cache)" : "")
		);
		
		buildQueue = buildQueue.filter(manifest => manifest.page !== page);
		
		let inProgressBuild = inProgressBuilds.find(b => b.page === page);
		
		if (inProgressBuild) {
			log("Awaiting in-progress build");
			
			await inProgressBuild.promise;
		}
		
		if (rebuild || !inProgressBuild) {
			log("Scheduling build");
			
			scheduleBuild(page, true, rebuild, noCache);
			
			while (!(inProgressBuild = inProgressBuilds.find(b => b.page === page))) {
				log("Waiting for build slot");
				
				await Promise.race(inProgressBuilds.map(b => b.promise));
			}
			
			log("Awaiting build");
			
			await inProgressBuild.promise;
			
			log("Build complete");
		}
	}
	
	return {
		scheduleBuild,
		build,
		
		async awaitPendingBuilds() {
			while (inProgressBuilds.length > 0) {
				await inProgressBuilds[0].promise;
			}
		},
	};
}
