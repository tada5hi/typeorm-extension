<script setup lang="ts">
import { computed } from 'vue';

import { splitInlineCode } from './inline-code';

type InlineCodeProps = {
    text: string;
};

const props = defineProps<InlineCodeProps>();

// Frontmatter copy with `name` rendered as <code>. The segments are the
// component's roots, so a section styles them with :deep(code).
const segments = computed(() => splitInlineCode(props.text));
</script>

<template>
    <template
        v-for="(segment, index) in segments"
        :key="index"
    >
        <code v-if="segment.code">{{ segment.text }}</code><span v-else>{{ segment.text }}</span>
    </template>
</template>

<style scoped>
code {
    white-space: nowrap;
}
</style>
