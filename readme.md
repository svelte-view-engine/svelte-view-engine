Svelte-render
=============

Svelte-render is a [view engine](https://expressjs.com/en/guide/using-template-engines.html) for rendering Svelte components in Express.

Aim
---

- To provide the minimal amount of functionality needed to write a .svelte file and render it with Express like you would a .ejs or .pug file.

Svelte-render compiles components on the fly (using [rollup-plugin-svelte](https://github.com/sveltejs/rollup-plugin-svelte)), so a Svelte-based site can be created with no extra build config and no separate "source" and "built" component files.

HTML is sent to the browser with all JavaScript and CSS inlined.  HTML, JavaScript and CSS are cached directly in memory.

Svelte-render can watch component files (including dependencies) and rebuild automatically for development.

Root templates
--------------

SSR-rendered components have `head` (tags to go in the `<head>`), `html` (the component html), and `css` -- but no surrounding `<!doctype>` or `<html>` tags.  To define these, you pass a single root template to svelte-render in the init options.  This file can use placeholders for all the relevant data from the Svelte component being rendered, for example:

template.html

```html
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
