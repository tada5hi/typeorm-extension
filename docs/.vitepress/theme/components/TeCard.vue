<script setup lang="ts">
import { computed } from 'vue';
import { isExternalLink } from '../links';

export type TeCardProps = {
    href?: string;
};

const props = withDefaults(defineProps<TeCardProps>(), { href: undefined });

const external = computed(() => !!props.href && isExternalLink(props.href));
</script>

<template>
    <a
        v-if="href"
        class="te-card te-card--link"
        :href="href"
        :target="external ? '_blank' : undefined"
        :rel="external ? 'noopener' : undefined"
    >
        <slot />
    </a>
    <div
        v-else
        class="te-card"
    >
        <slot />
    </div>
</template>
