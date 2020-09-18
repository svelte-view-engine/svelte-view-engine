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
		
		let server = await buildSsr(path, config);
		let client = await buildDom(path, name, config);
		
		let code = {
			client: client.js.code,
			server: server.component.code,
			css: server.css.code,
		};
		
		let hashes = {
			js: md5(code.client),
			css: md5(code.css),
		};
		
		await buildFile.parent.mkdirp();
		
		await buildFile.writeJson({
			server,
			client,
			hashes,
		});
		
		let base = fs(path).reparent(config.dir, config.buildDir);
		
		await Promise.all([
			base.reExt(".js").write(code.client),
			base.reExt(".css").write(code.css),
			base.reExt(".server.js").write(code.server),
		]);
	} catch (e) {
		console.error(e);
		
		process.exit(1);
	}
})();
