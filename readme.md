svelte-view-engine
==================

svelte-view-engine is an Express-compatible [view engine](https://expressjs.com/en/guide/using-template-engines.html) that renders Svelte components.

```javascript
const svelteViewEngine = require("svelte-view-engine");

let dir = "./pages";
let type = "html";

app.engine(type, svelteViewEngine({
	template: "./template.html", // see Root template below
	dir,
	type,
	init: true,
	watch: true,
	liveReload: true,
	componentBuilders: { // see Component builders below
		ssr: buildSsrComponent,
		dom: buildDomComponent,
	},
}));
	
app.set("view engine", type);
app.set("views", dir);

// ...

app.get("/", (req, res) => {
	res.render("Home", {
		name: "world" // renders ./pages/Home.html with props {name: "world"}
	});
});
```

It can also be used outside of Express.  `svelteViewEngine(options)` returns a function `(path, locals[, callback])`.  If `callback` is supplied it is called with `(error, html)`, otherwise a promise is returned.

Design
------

The motivation behind svelte-view-engine is to be able to build the view layer of a web app using a hierarchy of Svelte components and as little else as possible, while not having to "buy in" to a full app framework.

It is therefore a view engine (like Pug or EJS) as opposed to an app framework (like [Sapper](https://sapper.svelte.dev) or [Next.js](https://nextjs.org)).

Components are compiled and cached internally on the fly; there are no separate compiled files living in the codebase.

svelte-view-engine doesn't know how to compile Svelte components itself; you pass that in as functions.  This is to allow you to use your existing Svelte build process, or write one that suits you, instead of having it baked in to the view engine.

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
				props: ${props},
				hydrate: true,
			});
		</script>
	</body>
</html>
```

- `head` is the SSR-rendered markup from any `<svelte:head>` tags
- `css` is the CSS
- `html` is the SSR-rendered component markup
- `js` is the component code returned by `componentBuilders.dom`
- `name` is the basename of the .svelte file, and is used as the client-side component class name
- `props` is a JSON-stringified version of the object you pass to `res.render()`

Component builders
------------------

buildDomComponent
=================

This function should accept `(path, name, options, cache)` and return a promise that resolves to:

```javascript
{
	cache, // cache to pass to next invocation
	component, // Svelte component class
	css: {
		code: "...",
		map: "...",
	},
}
```

Arguments:

```
path: "/path/to/Component.svelte"
name: "Component"
options: the full options passed to svelteViewEngine
cache: .cache from previous output
```

###Example

Here is an example `buildDomComponent` function:

```javascript
let rollup = require("rollup");
let svelte = require("rollup-plugin-svelte");
let resolve = require("rollup-plugin-node-resolve");
let commonjs = require("rollup-plugin-commonjs");
let babel = require("./babel");
let sass = require("./sass");

module.exports = async (path, name, options, cache) => {
	let inputOptions = {
		input: path,
		cache,
		plugins: [
			svelte({
				hydratable: true,
				
				preprocess: {
					style: sass,
				},
				
				/*
				TODO
				
				client-side CSS is needed in dev because the bundle doesn't write
				any unchanged components' CSS when using cache (see issue below)
				using client-side CSS is OK for dev but not prod as you get a FOUC
				but we won't be using cache in prod anyway, so if the issue
				doesn't get resolved we could leave it like this, as it only
				affects dev
				
				https://github.com/rollup/rollup-plugin-svelte/issues/62
				
				if/when the issue is resolved this should be false as the ssr provides
				the css
				*/
				
				css: options.dev,
				
				onwarn: _ => null,
				
				dev: options.dev,
			}),
	
			resolve({
				browser: true,
			}),
			
			commonjs(),
		],
	};
	
	let outputOptions = {
		format: "iife",
		name,
	};
	
	let bundle = await rollup.rollup(inputOptions);
	
	let {output} = await bundle.generate(outputOptions);
	
	let js = output[0];
	
	if (options.transpile) {
		js = await babel(js.code);
	}
	
	if (options.minify) {
		// TODO terser
	}
	
	return {
		cache: bundle.cache,
		js,
		watchFiles: bundle.watchFiles,
	};
}
```

buildSsrComponent
=================

This function should accept `(path, options, cache)` and return a promise that resolves to:

```javascript
{
	cache, // cache to pass to next invocation
	component, // Svelte component class
	css: {
		code: "...",
		map: "...",
	},
}
```

Arguments:

```
path: "/path/to/Component.svelte"
options: the full options passed to svelteViewEngine
cache: .cache from previous output
```

###Example

Here is an example `buildSsrComponent` function:

```javascript
let rollup = require("rollup");
let svelte = require("rollup-plugin-svelte");
let resolve = require("rollup-plugin-node-resolve");
let commonjs = require("rollup-plugin-commonjs");
let requireFromString = require("./utils/requireFromString");
let sass = require("./sass");

module.exports = async (path, options, cache) => {
	let css;
	
	let inputOptions = {
		input: path,
		cache,
		plugins: [
			svelte({
				generate: "ssr",
				
				preprocess: {
					style: sass,
				},
				
				css: (c) => {
					css = c;
				},
				
				onwarn: _ => null,
			
				dev: options.dev,
			}),
	
			resolve({
				browser: true
			}),
			
			commonjs(),
		],
	};
	
	let outputOptions = {
		format: "cjs",
	};
	
	let bundle = await rollup.rollup(inputOptions);
	
	let {output} = await bundle.generate(outputOptions);
	
	return {
		cache: bundle.cache,
		component: await requireFromString(output[0].code),
		css,
	};
}

```

Props/payload
-------------

svelte-view-engine/payload exposes a global variable called `props` that makes the view locals available to all components, server-side and client-side.  To use the data client-side, set the `props` variable in your root template (before the `${js}` placeholder):

```html
...

<script>
	props = ${props};
	
	${js}
	
	new ${name}({
		...
	});
</script>

...
```

You can use it in your components like so:

```html
<script>
	import payload from "svelte-view-engine/payload";
	
	let data = payload.get();
</script>
```

Options
-------

`dev` = `process.env.NODE_ENV !== "production"`

`template`: Path to root template file.

`dir` (for use with `init`, see below): Pages directory (defaults to `"./pages"`).  This should be the same as the "views" option in Express.

`type` (for use with `init`, see below): File extension (defaults to `"html"`).  It's recommended to use a different extension for pages and sub-components, so that svelte-view-engine doesn't unnecessarily create pages for sub-components it finds in the pages directory (e.g. .html for pages and .svelte for sub-components).

`init`: Find all pages (files of `type` in `dir`) and build them on startup.  Defaults to `true`.  This avoids waiting for initial compilation the first time you request each page.

`watch`: Watch component files and dependencies and auto-rebuild (defaults to `dev`).

`liveReload`: Auto reload the browser when component rebuilds (defaults to `dev`).

`liveReloadPort`: WebSocket port to use for live reload message.  Defaults to a random port between 5000 and 65535 (this will throw an error if the port is in use, so if you're using a process manager it will restart the app until it finds an available port).

`excludeLocals`: Array of object keys to exclude from the locals that get passed to the component.  Some keys are added by Express, and may be unnecessary and/or security concerns if exposed.  This defaults to `["_locals", "settings", "cache"]` and is overwritten (not merged) with the supplied setting.
