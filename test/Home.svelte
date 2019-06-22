<script>
import Widget from "./Widget.svelte";

let prop = "789";

export let name = 123;
</script>

<style>
div {
	background: red;
}
</style>

<svelte:head>
	<title>Home</title>
	<meta name="viewport" content="width=device-width"/>
</svelte:head>

<svelte:body on:load={load}/>

<div>
	Hello {name}
	<Widget prop={prop}/>
</div>
