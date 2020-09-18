let remove = require("./utils/remove");

/*
schedule builds and limit concurrency for:

- fast rebuilds in dev
- cpu utilisation
- memory efficiency
*/

/*
NOTE build promise rejections are caught, meaning that subsequent
awaits on them will NOT throw.  check inProgressBuild.error if it
matters whether the promise resolved, or just settled.
*/

module.exports = function(config) {
	let inProgressBuilds = [];
	let buildQueue = [];
	
	function log(...args) {
		if (config.verbose) {
			console.log(...args);
		}
	}
	
	function checkQueue() {
		let toBuild = buildQueue.filter(function(page) {
			return !inProgressBuilds.find(b => b.page === page);
		}).slice(0, config.buildConcurrency - inProgressBuilds.length);
		
		if (toBuild.length > 0) {
			log("Building:");
		}
		
		for (let page of toBuild) {
			log(
				"    - "
				+ page.relativePath
			);
			
			remove(buildQueue, page);
			
			let inProgressBuild = {
				page,
				
				promise: page.build().catch(function(e) {
					log(
						"Page "
						+ page.relativePath
						+ " failed, checking queue"
					);
					
					console.error(e);
					
					inProgressBuild.error = e;
					
					remove(inProgressBuilds, inProgressBuild);
					
					checkQueue();
				}).finally(function() {
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
	
	function scheduleBuild(page, priority) {
		log(
			"Scheduling "
			+ page.relativePath
			+ (priority ? " (priority)" : "")
		);
		
		if (priority) {
			buildQueue.unshift(page);
		} else {
			buildQueue.push(page);
		}
		
		checkQueue();
	}
	
	function findInProgressBuild(page) {
		return inProgressBuilds.find(b => b.page === page);
	}
	
	async function build(page, priority) {
		log(
			"Build next: "
			+ page.relativePath
		);
		
		// drop any previously scheduled builds for this page
		
		buildQueue = buildQueue.filter(p => p !== page);
		
		let inProgressBuild = findInProgressBuild(page);
		
		if (inProgressBuild) {
			log(page.relativePath + ": awaiting in-progress build");
			
			await inProgressBuild.promise;
			
			if (inProgressBuild.error) {
				throw inProgressBuild.error;
			}
		}
		
		if (!inProgressBuild) {
			log(page.relativePath + ": scheduling build");
			
			scheduleBuild(page, priority);
			
			while (!(inProgressBuild = findInProgressBuild(page))) {
				log(page.relativePath + ": waiting for build slot");
				
				await Promise.race(inProgressBuilds.map(b => b.promise));
			}
			
			log(page.relativePath + ": awaiting build");
			
			await inProgressBuild.promise;
			
			if (inProgressBuild.error) {
				throw inProgressBuild.error;
			}
			
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
			while (inProgressBuilds.length > 0) {
				await inProgressBuilds[0].promise;
			}
		},
	};
}
