let buildSsrComponent = require("./buildSsrComponent");
let buildDomComponent = require("./buildDomComponent");

module.exports = async (path) => {
	let Component = await buildSsrComponent(path);
	let {head, html, css} = Component.render();
	let js = await buildDomComponent(path);
	
	return {
		head,
		html,
		js,
		css,
	};
}
