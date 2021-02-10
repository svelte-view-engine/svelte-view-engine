let yargs = require("yargs");
let fs = require("flowfs");

// default the --css option to true
yargs.option('css', { type: 'boolean', default: true });

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
			
			// this will add a css property to server if css is set to false. If not
			// specified, it will default to true. This is to simulate a component
			// without a style block
			...(yargs.argv.css && {
				css: {
					code: "css"
				}
			}),
		},
		
		client: {
			js: {
				code: "client component",
			},
		},
	});
})();
