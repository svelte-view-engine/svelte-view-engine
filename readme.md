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

Design goals
------------

Svelte-render is designed to be as minimal and flexible as possible, so it is a view engine (like Pug or EJS) as opposed to an app framework (like Sapper) -- but it also wires everything up so that you can just start writing .svelte files and serving them as views.

Components are compiled on the fly (using [rollup-plugin-svelte](https://github.com/sveltejs/rollup-plugin-svelte)), so there are no compiled component files stored anywhere.

Component JS and CSS are delivered inline in the HTML.  Everything is stored directly in memory, so once the pages are compiled, serving them has no I/O and very little processing overhead.

Svelte-render can watch component files (including dependencies) and rebuild automatically for development.

Root templates
--------------

Svelte components and `<slot>`s take the place of, for example, Pug layouts and mixins for all your re-use and composition needs; but pages still need a bit of surrounding boilerplate HTML that you can't define in Svelte -- `<!doctype>`, `<html></html>` etc -- and you also need a few lines of JS to actually instantiate the component.

To define these, you pass a single "root template" to be used for all pages.  This file uses placeholders for all the relevant data from the Svelte component being rendered, for example:

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
			var payload = ${locals};
			
			new ${name}({
				target: document.body,
				props: ${locals},
				hydrate: true,
			});
		</script>
	</body>
</html>
```
