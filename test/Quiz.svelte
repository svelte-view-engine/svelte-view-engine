<script>
import Main from "./layouts/Main.svelte";
import Question from "./Question.svelte";

export let q = 123;
</script>

<style>

</style>

<Main>
	<div>
		Questions
	</div>
	<Question {q}/>
</Main>
