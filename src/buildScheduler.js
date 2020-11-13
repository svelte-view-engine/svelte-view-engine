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
			return !findInProgressBuild(page);
		}).slice(0, config.buildConcurrency - inProgressBuilds.length);
		
		log("Checking queue - " + toBuild.length + " pages to build");
		
		for (let page of toBuild) {
			build(page);
		}
	}
	
	async function scheduleBuild(page, priority) {
		log("Schedule: " + page.relativePath + (priority ? " (priority)" : ""));
		
		if (priority) {
			remove(buildQueue, page);
			buildQueue.unshift(page);
		} else if (!buildQueue.includes(page)) {
			buildQueue.push(page);
		}
		
		checkQueue();
		
		let inProgressBuild;
		
		while (!(inProgressBuild = findInProgressBuild(page))) {
			await Promise.race(inProgressBuilds.map(b => b.build.complete));
		}
		
		await inProgressBuild.build.complete;
		
		if (inProgressBuild.error) {
			throw inProgressBuild.error;
		}
	}
	
	async function build(page) {
		log("Build: " + page.relativePath);
		
		cancelScheduledOrInProgress(page);
		
		let build = page.build();
		
		let inProgressBuild = {
			page,
			build,
		};
		
		build.complete.catch(function(e) {
			inProgressBuild.error = e;
		}).finally(function() {
			remove(inProgressBuilds, inProgressBuild);
			
			checkQueue();
		});
		
		inProgressBuilds.push(inProgressBuild);
		
		await build.complete;
		
		if (inProgressBuild.error) {
			throw inProgressBuild.error;
		}
	}
	
	function cancelScheduledOrInProgress(page) {
		remove(buildQueue, page);
		
		let inProgressBuild = findInProgressBuild(page);
		
		if (inProgressBuild) {
			inProgressBuild.build.buildProcess.kill();
			inProgressBuild.canceled = true;
		}
	}
	
	function findInProgressBuild(page) {
		return inProgressBuilds.find(b => b.page === page);
	}
	
	return {
		scheduleBuild,
		build,
		
		hasPendingBuilds() {
			return inProgressBuilds.length > 0;
		},
		
		async awaitPendingBuilds() {
			while (inProgressBuilds.length > 0) {
				await inProgressBuilds[0].build.complete;
			}
		},
	};
}
