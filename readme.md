Svelte-render
=============

Svelte-render is a [view engine](https://expressjs.com/en/guide/using-template-engines.html) for Express that renders Svelte components.

```javascript
const svelteRender = require("svelte-render");

app.engine("svelte", svelteRender({
	template: "./template.html", // see Root template below
	watch: true, // auto-rebuild on changes
	liveReload: true, // live reloading
	svelte: {
		// rollup-plugin-svelte config
	},
}));

app.set("views", "./pages");
app.set("view engine", "svelte");

app.get("/", (req, res) => {
	res.render("Home", {
		name: "world" // renders ./pages/Home.svelte with props {name: "world"}
	});
});
```

Design
------

Svelte-render is designed to be as minimal and flexible as possible, so it is a view engine (like Pug or EJS) as opposed to an app framework (like [Sapper](https://sapper.svelte.dev) or [Next.js](https://nextjs.org)).

Components are compiled on the fly (using [rollup-plugin-svelte](https://github.com/sveltejs/rollup-plugin-svelte)).

Component JS and CSS are delivered inline and the whole thing is stored directly in memory once compiled, so serving a page requires no I/O.  SSR can optionally be done every time (for SEO and efficient hydration on the client) or once at build time (with empty locals) for even less per-request overhead on the server.

You can watch component files and their dependencies for auto-rebuilding in development.

Root template
-------------

Svelte components and `<slot>`s take the place of, for example, Pug layouts and mixins for all your re-use and composition needs, but pages still need a bit of surrounding boilerplate HTML that you can't define in Svelte -- `<!doctype>`, `<html>` etc -- and you also need a few lines of JS to actually instantiate the component.

To define these, you pass a single "root template" to be used for all pages.  This file uses placeholders for the different elements of the Svelte component being rendered:

```html
// template.html

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
				props: ${locals},
				hydrate: true,
			});
		</script>
	</body>
</html>
```

- `head` is the SSR-rendered markup from any `<svelte:head>` tags
- `css` is the CSS
- `html` is the SSR-rendered component markup
- `js` is the component code as an IIFE
- `name` is the basename of the .svelte file, and is used as the client-side component class name
- `locals` is a JSON-stringified version of the object you pass to `res.render()`

Options
-------

	let options = merge({
		template: null,
		watch: dev,
		liveReload: dev,
		minify: !dev,
		useLocalsForSsr: false,
		svelte: {
			dev,
		},
		excludeLocals: [
			"_locals",
			"settings",
			"cache",
		],
	}, opts);

`template`: Path to root template file

`watch`: Watch component files and dependencies and auto-rebuild (defaults to `process.env.NODE_ENV !== "production"`)

`liveReload`: Auto reload the browser when component rebuilds (defaults to `process.env.NODE_ENV !== "production"`) (TODO implement this)

`minify`: Use [rollup-plugin-terser]() to minify CSS and JS (defaults to `process.env.NODE_ENV === "production"`)

`useLocalsForSsr`: `true` to perform server-side rendering on every request, with the supplied locals.  `false` to perform server-side rendering once, at build time, and cache the results until the next rebuild (defaults to `false`)

`svelte`: Options to pass to [rollup-plugin-svelte](https://github.com/sveltejs/rollup-plugin-svelte).  This starts as `{dev: process.env.NODE_ENV !== "production"}` and is deep-merged with the supplied options.

`excludeLocals`: Array of object keys to exclude from the locals that get passed to the component.  Some keys are added by Express, and may be unnecessary and/or security concerns if exposed.  This defaults to `["_locals", "settings", "cache"]` and is overwritten entirely (not deep-merged) with the supplied setting.
