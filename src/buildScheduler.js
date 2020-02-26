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
			return !inProgressBuilds.find(b => b.page === page);
		}).slice(0, options.buildConcurrency - inProgressBuilds.length);
		
		if (toBuild.length > 0) {
			log("Building:");
		}
		
		for (let manifest of toBuild) {
			let {
				page,
				useCache,
			} = manifest;
			
			log(
				"    - "
				+ page.relativePath
				+ (useCache ? " (use cache)" : "")
			);
			
			remove(buildQueue, manifest);
			
			let inProgressBuild = {
				page,
				
				promise: page.build(useCache).finally(function() {
					log(
						"Page "
						+ page.relativePath
						+ " finished, checking queue"
					);
					
					remove(inProgressBuilds, inProgressBuild);
					checkQueue();
				}),
			};
			
			inProgressBuilds.push(inProgressBuild);
		}
	}
	
	function scheduleBuild(page, priority, useCache=false) {
		let manifest = {
			page,
			useCache,
		};
		
		log(
			"Scheduling "
			+ page.relativePath
			+ (priority ? " (priority)" : "")
			+ (useCache ? " (use cache)" : "")
		);
		
		if (priority) {
			buildQueue.unshift(manifest);
		} else {
			buildQueue.push(manifest);
		}
		
		checkQueue();
	}
	
	function findInProgressBuild(page) {
		return inProgressBuilds.find(b => b.page === page);
	}
	
	async function build(page, useCache=false) {
		log(
			"Build next: "
			+ page.relativePath
			+ (useCache ? " (use cache)" : "")
		);
		
		// drop any previously scheduled builds for this page
		
		buildQueue = buildQueue.filter(manifest => manifest.page !== page);
		
		let inProgressBuild = findInProgressBuild(page);
		
		if (inProgressBuild) {
			log(page.relativePath + ": awaiting in-progress build");
			
			try {
				await inProgressBuild.promise;
			} catch (e) {
				console.error(e);
			}
		}
		
		if (!inProgressBuild) {
			log(page.relativePath + ": scheduling build");
			
			scheduleBuild(page, useCache);
			
			try {
				while (!(inProgressBuild = findInProgressBuild(page))) {
					log(page.relativePath + ": waiting for build slot");
					
					await Promise.race(inProgressBuilds.map(b => b.promise));
				}
			} catch (e) {
				console.error(e);
			}
			
			log(page.relativePath + ": awaiting build");
			
			await inProgressBuild.promise;
			
			log(page.relativePath + ": build complete");
		}
	}
	
	return {
		scheduleBuild,
		build,
		
		hasPendingBuilds() {
			return inProgressBuilds.length > 0;
		},
		
		async awaitPendingBuilds() {
			try {
				while (inProgressBuilds.length > 0) {
					await inProgressBuilds[0].promise;
				}
			} catch (e) {
				console.error(e);
			}
		},
	};
}
