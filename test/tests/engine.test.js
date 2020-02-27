let fs = require("flowfs");
let {deep} = require("../utils/assertions");
let svelteViewEngine = require("../../index");

function config(overrides) {
	let here = path => fs("test").child(path).path;
	
	return Object.assign({
		template: here("./template.json"),
		dir: here("./pages"),
		type: "html",
		buildScript: here("./build.js"),
		buildDir: here("./build"),
		watch: false,
		buildConcurrency: 2,
		verbose: false,
	}, overrides);
}

async function render(engine, page) {
	return await engine.render(engine.dir + "/" + page + "." + engine.type);
}

describe("svelte-view-engine", function() {
	describe("engine", function() {
		it("renders page", async function() {
			let engine = svelteViewEngine(config());
			
			let res = JSON.parse(await render(engine, "A"));
			
			deep(res, {
				head: "head",
				css: "css",
				html: "html",
				props: "{}",
				js: "client component",
				name: "A",
			});
		});
	});
});
