/*
Payload - per-request data that's available to all Svelte components,
both clientside and serverside.

the value is set in Page.render() for serverside, and by top-level JS for
clientside (props = ...)
*/

let g = typeof window !== "undefined" ? window : global;

module.exports = {
	set(value) {
		g.props = value;
	},
	
	get() {
		return g.props;
	},
};
