let yargs = require("yargs");
let fs = require("flowfs");

(async function() {
	let {
		name,
		path,
		buildPath,
		options,
		useCache,
	} = JSON.parse(yargs.argv._[0]);
	
	let buildFile = fs(buildPath);
	
	await buildFile.parent.mkdirp();
	
	await buildFile.writeJson({
		server: {
			component: `
				module.exports = {
					render() {
						return {
							head: "head",
							html: "html",
						};
					},
				};
			`,
			
			css: {
				code: "css",
			},
		},
		
		client: {
			js: {
				code: "client component",
			},
		},
	});
})();
