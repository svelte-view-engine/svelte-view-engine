svelte-view-engine
==================

svelte-view-engine is an Express-compatible [view engine](https://expressjs.com/en/guide/using-template-engines.html) that renders Svelte components.

14.x release note
-----------------

Version 14 includes a Svelte build script to simplify the interface and avoid having large build scripts in your app.  The build uses rollup and transpiles to ES5 in production.  You can still supply a custom build script via the `buildScript` option.

Example app: [https://github.com/svelte-view-engine/sve-app](https://github.com/svelte-view-engine/sve-app).

```javascript
const svelteViewEngine = require("svelte-view-engine");

let engine = svelteViewEngine({
	env: "dev",
	template: "./template.html",
	dir: "./pages",
	type: "html",
	buildDir: "../artifacts/pages",
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

Design
======

The motivation behind svelte-view-engine is to be able to build the view layer of a web app using a hierarchy of Svelte components and as little else as possible, while not having to buy in to a full app framework.

It is therefore a view engine (like Pug or EJS) as opposed to an app framework (like [Sapper](https://sapper.svelte.dev) or [Next.js](https://nextjs.org)).

Root template
=============

Svelte components and `<slot>`s take the place of, for example, Pug layouts and mixins for all your re-use and composition needs, but pages still need a bit of surrounding boilerplate HTML that you can't define in Svelte -- `<!doctype>`, `<html>` etc -- and you also need a few lines of JS to instantiate the component on the client.

This code is defined in a single root template that's used for all pages, with `${}` placeholders for the page content:

```html
// template.html

<!doctype html>
<html>
	<head>
		${head}
		<style>
			${include ./global.css}
			
			${css}
		</style>
	</head>
	<body>
		${html}
		<script>
			props = ${props};
			
			${js}
			
			new ${name}({
				target: document.body,
				props: props,
				hydrate: true
			});
		</script>
	</body>
</html>
```

Placeholders:

- `head` - the SSR-rendered markup from any `<svelte:head>` tags.
- `html` - the SSR-rendered component markup.
- `css` - the CSS.
- `cssPath` - the path to the external CSS file.
- `jsPath` - the path to the external JS file.
- `name` - the basename of the .html file, used as the clientside component class name (sanitised to make it a valid identifier).
- `props` - a JSON payload of the object you pass to `res.render()`.  See the `payloadFormat` option for formatting options.
- `include /path/to/file` - replaced with the contents of the file.

CSS and client-side JS are saved alongside the built pages.  For CSS you can either use `${cssPath}` in a `link`, or `${css}` in a `<style>` tag.  Unfortunately there is a closing `</script>` tag in the Svelte runtime code (see [this issue](https://github.com/sveltejs/svelte/issues/4980)), so JS must be referenced externally.  The `${js}` placeholder is still available to use in an inline `<script>` in case you have a workaround.

JS and CSS (if not inline) must be served somehow, e.g. with `express.static()`, and the `assetsPrefix` option set to the path they're available at:

```js
// buildDir set to "./artifacts/pages"
// assetsPrefix set to "/assets/"

// ./src/app.js:

express.static("/assets", __dirname + "/../artifacts/pages");

// ./src/template.html:

// <link rel="stylesheet" href="${cssPath}">
// ...
// <script src="${jsPath}"></script>
```

Props/payload
=============
  
The `svelte-view-engine/payload` module makes view locals available to all components, clientside and serverside.  To achieve this, the props of the currently-rendering page are stored in a global variable called `props`.  On the server, this holds the original object passed to `res.render()`.  On the client, it's inserted into the root template as a string of JSON.  It can be injected into the template in various ways, depending on your setup:

- set `payloadFormat` to `"templateString"` to get the props as a template string: `props = ${props};` -> `props = [backtick]{"a":1}[backtick];`

- set `payloadFormat` to `"json"` (the default) and evaluate the JSON directly as JavaScript: `props = ${props};` -> `props = {"a":1};`

- put the JSON string into a script tag:

	```
	<script type="application/json" id="payload">
		${props}
	</script>
	<script>
		props = document.getElementById("payload").text;
		
		// ...
	</script>
	```

Keeping the payload as a string is most flexible, and allows you to parse it with your own code if you don't use `export let` (if you use `export let`, it must be a live object that you can pass to the clientside component `props` option).

You access the props in pages like so:

```html
<script>
	import payload from "svelte-view-engine/payload";
	
	let {
		a, // 1
	} = payload.get();
</script>
```

You can also just use `export let` as normal:

```html
<!-- Root template -->

<script>
	${js}
	
	new ${name}({
		target: document.body,
		props: ${props},
		hydrate: true,
	});
</script>

<!-- Page -->

<script>
	export let a; // 1
</script>
```

When to use `payload` instead of `export let`:

- You want to access props from a sub-component without having to pass them down the hierarchy.

- You need to process the data somehow before using it, for example to parse it using a JSON reviver function that depends on your app code.  In this case you would write a module that reads the payload and exposes the modified version, then use that module in your pages.

_rebuild
========

If `props._rebuild` is true, the page is rebuilt before being rendered.  This can be hooked up to the hard reload feature in Chrome via the Cache-Control header (file watching should make sure pages are rebuilt when a dependency changes, but sometimes it's useful to be able to force a rebuild in development, for example if the app has been offline while making changes):

```
app.use(function (req, res, next) {
	if (req.headers["cache-control"] === "no-cache") {
		res.locals._rebuild = true;
	}
	
	next();
});
```

Stores/SSR gotchas
==================

Svelte stores, and any other global values, must be implemented carefully to avoid sharing values between all users of the app.  Since stores are only useful if they're global, and being global on the server means being shared between all users of the app, svelte-view-engine provides a hook to do any setting or clearing of stores before each render.

Pass a function to the `prerender` option to do the work.  The function will receive a single argument, the view locals.

Building pages for production
=============================

If you look in the `dir` directory, you'll notice the files are all stored under a directory named after the env used when building them.  If you haven't built pages for production yet, this will just contain `dev`.

To build pages for production, create a file called `svelte-view-engine.js` and export your config from it (the same object you pass to `svelteViewEngine` when instantiating it to pass to Express):

```
module.exports = {
	env: "dev",
	template: "./template.html",
	dir: "./pages",
	type: "html",
	buildDir: "../artifacts/pages",
};
```

Then run `$ npx svelte-view-engine build prod`.

This will create a directory called `prod` under `dir` (if it doesn't exist already), and output prod page files to it.

Options
=======

`env`: `"dev"` or `"prod"`.  Defaults to `"prod"`.

`template`: Path to root template.

`dir`: Pages (views) directory.

`type`: Page file extension.  It's recommended to use a different extension for pages and components, so that svelte-view-engine doesn't unnecessarily build non-page components it finds in the pages directory (e.g. .html for pages and .svelte for other components).  Defaults to `"html"`.

`init`: Find all pages (files of `type` in `dir`) and initialise them on startup.  Defaults to `false`.

`buildDir`: Where to output built pages and their CSS and JS files.

`watch`: Watch component files and dependencies and auto-rebuild.  Defaults to `true` in development.

`liveReload`: Auto reload the browser when component rebuilds.  Defaults to `true` in development.

`excludeLocals`: Array of object keys to exclude from the locals that get passed to the component.  Some keys are added by Express, and may be unnecessary and/or security concerns if exposed.  This defaults to `["_locals", "settings", "cache"]` and is overwritten (not merged) with the supplied setting.

`assetsPrefix`: Path to prepend to external JS/CSS URLs that are available in the root template as `${jsPath}` and `${cssPath}`.  Should include trailing slash.

`prerender`: Optional function to call before each SSR render.

`payloadFormat`: Format of the `${props}` placeholder value.  Defaults to `"json"`, which inserts a string of JSON directly (must be inserted into a script tag as JSON can contain both single and double quotes).  Set to `"templateString"` to wrap the JSON as a backtick-quoted string.  String values in the JSON must not contain unescaped backticks if using this option.

`svelteDirs`: Optional.  Pass an array of directories that contain Svelte files to mark files NOT within those directories as external for rolling up SSR modules.  If ommitted, no modules will be treated as external.  The purpose of this is to avoid having copies of e.g. utility scripts bundled into every SSR module.

`buildScript`: Optional.  Path to a custom build script.  The build script should accept a JSON payload on either stdin or as the only argument (both are provided), and write out the JSON manifest and CSS/JS files for the page (see [https://github.com/svelte-view-engine/svelte-view-engine/blob/master/src/build/build.js](https://github.com/svelte-view-engine/svelte-view-engine/blob/master/src/build/build.js).
