<script setup lang="ts">
import { computed } from 'vue';

export type TeHeadingProps = {
    title: string;
    highlight?: string;
    eyebrow?: string;
    lede?: string;
    align?: 'start' | 'center';
    level?: 1 | 2;
};

const props = withDefaults(defineProps<TeHeadingProps>(), {
    highlight: undefined,
    eyebrow: undefined,
    lede: undefined,
    align: 'start',
    level: 2,
});

const classes = computed(() => ['te-heading', `te-heading--${props.align}`]);
const tag = computed(() => `h${props.level}`);
</script>

<template>
    <div :class="classes">
        <span
            v-if="eyebrow"
            class="te-heading__eyebrow"
        >{{ eyebrow }}</span>
        <component
            :is="tag"
            :class="`te-heading__title te-heading__title--h${level}`"
        >
            {{ title }}<template v-if="highlight">
                {{ ' ' }}<span class="te-heading__highlight">{{ highlight }}</span>
            </template>
        </component>
        <p
            v-if="lede"
            class="te-heading__lede"
        >
            {{ lede }}
        </p>
    </div>
</template>
