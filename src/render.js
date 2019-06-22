let getSsrComponent = require("./getSsrComponent");
let getDomComponent = require("./getDomComponent");
let fs = require("flowfs");

/*
options

- whether to render the SSR once and cache (without any props) or on each res.render
*/

let cache = {};

module.exports = async (path) => {
	if (cache[path]) {
		return cache[path];
	}
	
	let name = fs(path).basename;
	
	let Component = await getSsrComponent(path);
	let {head, html, css} = Component.render();
	let js = await getDomComponent(path);
	
	let str = `
		<!doctype html>
		<html>
			<head>
				${head}
				<style>
				${css}
				</style>
			</head>
			<body>
				${html}
				<script>
				${js}
				</script>
				<script>
				new ${name}({
					target: document.body,
					hydrate: true,
				});
				</script>
			</body>
		</html>
	`;
	
	console.log(str);
}
