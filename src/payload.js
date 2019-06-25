/*
Payload - per-request globals that are available to all Svelte components,
both clientside and serverside.

Svelte stores can't be used because they are global to the entire JS environment,
so users would see each other's values.

the value is set in Page.render() for serverside, and by top-level JS for
clientside (var props = ...)
*/

let g = typeof window !== "undefined" ? window : global;

module.exports = {
	set(value) {
		g.props = value;
	},
	
	get() {
		return g.props;
	}
};
