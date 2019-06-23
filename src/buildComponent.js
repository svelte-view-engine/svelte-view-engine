let getSsrComponent = require("./getSsrComponent");
let getDomComponent = require("./getDomComponent");

module.exports = async (path) => {
	let Component = await getSsrComponent(path);
	let {head, html, css} = Component.render();
	let js = await getDomComponent(path);
	
	return {
		head,
		html,
		js,
		css,
	};
}
