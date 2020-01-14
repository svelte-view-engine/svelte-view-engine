svelte-view-engine
==================

svelte-view-engine is an Express-compatible [view engine](https://expressjs.com/en/guide/using-template-engines.html) that renders Svelte components.

Example app: [https://github.com/user896724/sve](https://github.com/user896724/sve).

```javascript
const svelteViewEngine = require("svelte-view-engine");

let engine = svelteViewEngine({
	template: "./template.html", // see Root template below
	dir: "./pages",
	type: "html",
	init: true,
	watch: true,
	liveReload: true,
	// See Build script below
	buildScript: "./scripts/svelte/build.js",
	buildDir: "/tmp/svelte-build",
});

app.engine(engine.type, engine.render);
app.set("view engine", engine.type);
app.set("views", engine.dir);

// ...

app.get("/", (req, res) => {
	res.render("Home", {
		name: "world" // renders ./pages/Home.html with props {name: "world"}
	});
});
```

It can also be used outside of Express.  `svelteViewEngine(options)` returns an object with `render(path, locals[, callback])`.  If `callback` is supplied it is called with `(error, html)`, otherwise a promise is returned.

Design
======

The motivation behind svelte-view-engine is to be able to build the view layer of a web app using a hierarchy of Svelte components and as little else as possible, while not having to "buy in" to a full app framework.

It is therefore a view engine (like Pug or EJS) as opposed to an app framework (like [Sapper](https://sapper.svelte.dev) or [Next.js](https://nextjs.org)).

svelte-view-engine doesn't know how to compile Svelte components itself; you pass it the path to a build script to run.  This allows you to use your existing Svelte build process, or write one that suits you, instead of having it baked in to the view engine.

Root template
=============

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

Build script
============

This is implemented as a separate script so that the build process doesn't inflate the memory usage of the main app.  It should accept one command-line argument, a JSON payload of the following form:

```
{
	name, // Component
	path, // /src/path/to/Component.html
	buildPath, // /build/path/to/Component.html.json
	noCache, // Don't use cached bundles
	options, // The options passed to svelteViewEngine
}
```

It should compile the component and place the output in the file at `buildPath` in the form of:

```
{
	client: {
		cache, // options.cache && bundle.cache
		js, // client-side js
		watchFiles, // list of paths to watch for changes
	},
	server: {
		cache, // options.cache && bundle.cache
		component, // server-side js
		css, // css
	}
}
```

Props/payload
=============

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

Build scheduling
================

When you modify a component that's used by many pages, with a naive approach all of these pages would immediately see the change and rebuild themselves, meaning you might have to wait for the whole thing to process before seeing your changes.  Similarly, when building pages for the first time, trying to build all of them at once could easily crash a small server.

To solve these issues there are two features: priority builds/active pages; and the `buildConcurrency` option.

Active pages
------------

In development, pages keep a websocket open with a regular heartbeat to keep track of whether they're open in a browser (active).  On dependency changes, inactive pages wait for 100ms before scheduling themselves for rebuild, to allow active pages to see the change and schedule themselves first.  Active pages also pass a "priority" argument to the scheduler, which just means they get added straight to the "out" end of the build queue.

buildConcurrency
----------------

`buildConcurrency` defaults to `os.cpus().length`, and limits the number of concurrent build processes to save memory while maximising CPU utilisation.

_rebuild
========

If `props._rebuild` is true, the page is rebuilt before being rendered.  This can be hooked up to the hard reload feature in Chrome via the Cache-Control header:

```
app.use(function (req, res, next) {
	if (req.headers["cache-control"] === "no-cache") {
		res.locals._rebuild = true;
	}
	
	next();
});
```

Options
=======

`dev` = `process.env.NODE_ENV !== "production"`

`template`: Path to root template file.

`dir`: Pages directory.

`type`: File extension (defaults to `"html"`).  It's recommended to use a different extension for pages and components, so that svelte-view-engine doesn't unnecessarily build non-page components it finds in the pages directory (e.g. .html for pages and .svelte for other components).

`init`: Find all pages (files of `type` in `dir`) and build them on startup.  Defaults to `true`.  This avoids waiting for initial compilation the first time you request each page.

`buildScript`: Path to build script.

`buildDir`: Where to keep built pages.  This should be unique per project, e.g. `"/tmp/myAppSvelteBuild"`

`buildConcurrency`: The maximum number of pages to build concurrently.  Defaults to the number of processor cores.

`watch`: Watch component files and dependencies and auto-rebuild.  Defaults to `dev`.

`liveReload`: Auto reload the browser when component rebuilds.  Defaults to `dev`.

`liveReloadPort`: WebSocket port to use for live reload message.  Defaults to a random port between 5000 and 65535 (this will throw an error if the port is in use, so if you're using a process manager it will restart the app until it finds an available port).

`minify`: Passed through to the build script.  Defaults to `dev`.

`transpile`: Passed through to the build script.  Defaults to `dev`.

`excludeLocals`: Array of object keys to exclude from the locals that get passed to the component.  Some keys are added by Express, and may be unnecessary and/or security concerns if exposed.  This defaults to `["_locals", "settings", "cache"]` and is overwritten (not merged) with the supplied setting.

`saveJs`: Save component js in .client.js and .server.js files in the build dir.  Defaults to `dev`.
