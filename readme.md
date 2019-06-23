Svelte-render
=============

Svelte-render is a [view engine](https://expressjs.com/en/guide/using-template-engines.html) for rendering Svelte components in Express.

Svelte-render compiles components on the fly (using [rollup-plugin-svelte](https://github.com/sveltejs/rollup-plugin-svelte)), so a Svelte-based site can be created with no extra build config and no separate "source" and "built" component files.

HTML is sent to the browser with all JavaScript and CSS inlined.  HTML, JavaScript and CSS are cached directly in memory.

Svelte-render can watch component files (including dependencies) and rebuild automatically for development.
