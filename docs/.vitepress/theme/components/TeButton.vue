<script setup lang="ts">
import { computed } from 'vue';
import { isExternalLink } from '../links';

export type TeButtonProps = {
    href: string;
    variant?: 'primary' | 'ghost';
};

const props = withDefaults(defineProps<TeButtonProps>(), { variant: 'primary' });

const external = computed(() => isExternalLink(props.href));
const classes = computed(() => ['te-button', `te-button--${props.variant}`]);
</script>

<template>
    <a
        :class="classes"
        :href="href"
        :target="external ? '_blank' : undefined"
        :rel="external ? 'noopener' : undefined"
    >
        <slot />
    </a>
</template>
