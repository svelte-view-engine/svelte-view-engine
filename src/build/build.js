let yargs = require("yargs");
let fs = require("flowfs");
let md5 = require("md5");
let readStream = require("../utils/readStream");
let buildSsr = require("./buildSsrComponent");
let buildDom = require("./buildDomComponent");

(async function() {
	try {
		let {
			name,
			path,
			buildPath,
			config,
		} = JSON.parse(await readStream(process.stdin));
		
		let buildFile = fs(buildPath);
		
		let client;
		let server = await buildSsr(path, config);
		
		if (config.dom) {
			client = await buildDom(path, name, config);
		}
		
		let code = {
			client: client && client.js.code,
			server: config.ssr && server.component,
			css: server.css,
		};
		
		let hashes = {
			js: client && md5(code.client),
			css: code.css && md5(code.css),
		};
		
		await buildFile.parent.mkdirp();
		
		await buildFile.writeJson({
			server,
			client,
			hashes,
		});
		
		let base = fs(path).reparent(config.dir, config.buildDir);
		
		await Promise.all([
			client && base.reExt(".js").write(code.client),
			base.reExt(".css").write(code.css),
			config.ssr && base.reExt(".server.js").write(code.server),
		]);
	} catch (e) {
		console.error(e);
		
		process.exit(1);
	}
})();
