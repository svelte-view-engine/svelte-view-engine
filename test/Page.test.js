let Page = require("../src/Page");
let Template = require("../src/Template");

process.chdir(__dirname);

let options = {
	liveReload: false,
	watch: false,
	minify: false,
	svelte: {
		dev: true,
	},
};

(async () => {
	let template = new Template("./template.html", options);
	let page = new Page(template, __dirname + "/pages/Index.html", options);
	
	await page.build();
	
	console.log(await page.render({}));
})();
