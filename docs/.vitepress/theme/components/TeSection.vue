<script setup lang="ts">
import { computed } from 'vue';

export type TeSectionSurface = 'default' | 'tinted' | 'dark';

export type TeSectionProps = {
    surface?: TeSectionSurface;
    id?: string;
};

const props = withDefaults(defineProps<TeSectionProps>(), { surface: 'default', id: undefined });

const classes = computed(() => ['te-section', `te-section--${props.surface}`]);
</script>

<template>
    <section
        :id="id"
        :class="classes"
    >
        <div class="te-container">
            <slot />
        </div>
    </section>
</template>
