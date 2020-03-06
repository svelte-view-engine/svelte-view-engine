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
				options,
			} = manifest;
			
			log(
				"    - "
				+ page.relativePath
				+ (options ? " " + JSON.stringify(options) : "")
			);
			
			remove(buildQueue, manifest);
			
			let inProgressBuild = {
				page,
				
				promise: page.build(options).catch(function(e) {
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
	
	function scheduleBuild(page, priority, options) {
		let manifest = {
			page,
			options,
		};
		
		log(
			"Scheduling "
			+ page.relativePath
			+ (priority ? " (priority)" : "")
			+ (options ? " " + JSON.stringify(options) : "")
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
	
	async function build(page, priority, options) {
		log(
			"Build next: "
			+ page.relativePath
		);
		
		// drop any previously scheduled builds for this page
		
		buildQueue = buildQueue.filter(manifest => manifest.page !== page);
		
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
			
			scheduleBuild(page, priority, options);
			
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
