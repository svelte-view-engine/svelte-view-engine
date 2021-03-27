let fs = require("flowfs");
let {deep} = require("../utils/assertions");
let svelteViewEngine = require("../../index");

let here = path => fs("test").child(path).path;
function config(overrides) {
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
		beforeEach(async function() {
			await fs(config().buildDir).rmrf();
		});
		
		it("renders page from no build dir, no init", async function() {
			let engine = svelteViewEngine(config({
				init: false
			}));
			
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

		it("renders page from no build dir, no init, without css", async function() {
			let engine = svelteViewEngine(config({
				init: false,
				// hacky way to tell the test build script to not include css
				buildScript: `${here("./build.js")} --no-css`,
			}));
			
			let res = JSON.parse(await render(engine, "A"));
			
			deep(res, {
				head: "head",
				css: "undefined",
				html: "html",
				props: "{}",
				js: "client component",
				name: "A",
			});
		});

		it("renders page from no build dir, no init", async function() {
			let engine = svelteViewEngine(config({
				init: true
			}));
			
			let res = JSON.parse(await render(engine, "A"));
			
			deep(res, {
				head: "head",
				css: "css",
				html: "html",
				props: "{}",
				js: "client component",
				name: "A",
			});

			await engine._initPromise;
			
			a = JSON.parse(await render(engine, "A"));
			
			deep(a, {
				head: "head",
				css: "css",
				html: "html",
				props: "{}",
				js: "client component",
				name: "A",
			});
		});
		
		it("renders page from prebuilt, no init", async function() {
			let engine = svelteViewEngine(config({
				init: false
			}));
			
			await engine.buildPages();
			
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
		
		it("renders page from prebuilt, init (before and after init)", async function() {
			let prebuild = svelteViewEngine(config({
				init: false
			}));
			
			await prebuild.buildPages();
			
			let engine = svelteViewEngine(config({
				init: true,
			}));
			
			let a = JSON.parse(await render(engine, "A"));
			
			deep(a, {
				head: "head",
				css: "css",
				html: "html",
				props: "{}",
				js: "client component",
				name: "A",
			});
			
			await engine._initPromise;
			
			a = JSON.parse(await render(engine, "A"));
			
			deep(a, {
				head: "head",
				css: "css",
				html: "html",
				props: "{}",
				js: "client component",
				name: "A",
			});
			
			let b = JSON.parse(await render(engine, "B"));
			
			deep(b, {
				head: "head",
				css: "css",
				html: "html",
				props: "{}",
				js: "client component",
				name: "B",
			});
			
			let c = JSON.parse(await render(engine, "C"));
			
			deep(c, {
				head: "head",
				css: "css",
				html: "html",
				props: "{}",
				js: "client component",
				name: "C",
			});
		});
	});
});
