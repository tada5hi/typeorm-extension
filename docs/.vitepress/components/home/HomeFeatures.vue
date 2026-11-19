<script setup lang="ts">
import { useData, withBase } from 'vitepress';
import { computed } from 'vue';

import InlineCode from './InlineCode.vue';

type FeatureItem = {
    title: string;
    text: string;
    code: string;
    link: string;
};

type FeaturesFrontmatter = {
    eyebrow: string;
    title: string;
    lede: string;
    items: FeatureItem[];
};

const { frontmatter } = useData();

const features = computed(() => frontmatter.value.features as FeaturesFrontmatter);
const items = computed(() => features.value.items.map((item, index) => ({
    ...item,
    href: withBase(item.link),
    index: String(index + 1).padStart(2, '0'),
})));
</script>

<template>
    <TeSection
        surface="tinted"
        class="home-features"
    >
        <TeHeading
            :eyebrow="features.eyebrow"
            :title="features.title"
            :lede="features.lede"
        />
        <ul class="home-features__grid">
            <li
                v-for="item in items"
                :key="item.title"
            >
                <TeCard
                    class="home-features__card"
                    :href="item.href"
                >
                    <span class="home-features__index">{{ item.index }}</span>
                    <h3>{{ item.title }}</h3>
                    <p>
                        <InlineCode :text="item.text" />
                    </p>
                    <pre class="home-features__snippet"><code>{{ item.code }}</code></pre>
                </TeCard>
            </li>
        </ul>
    </TeSection>
</template>

<style scoped>
.home-features__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1px;
    margin: 44px 0 0;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--te-color-border);
    border-radius: 14px;
    background: var(--te-color-border);
    list-style: none;
}

@media (min-width: 640px) {
    .home-features__grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
    }
}

@media (min-width: 960px) {
    .home-features__grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}

.home-features__grid > li {
    min-width: 0;
}

.home-features__card {
    grid-template-rows: auto auto 1fr auto;
    gap: 12px;
    padding: 26px 24px 24px;
    border: 0;
    border-radius: 0;
}

.home-features__card:hover {
    transform: none;
    background: var(--te-color-bg-elevated);
}

.home-features__index {
    color: var(--te-color-primary-text);
    font-family: var(--te-font-mono);
    font-size: 12px;
}

.home-features__card p :deep(code) {
    color: var(--te-color-fg);
    font-family: var(--te-font-mono);
    font-size: 0.9em;
}

.home-features__snippet {
    margin: 6px 0 0;
    padding: 10px 12px;
    overflow-x: auto;
    border: 1px solid var(--te-color-border);
    border-radius: 8px;
    background: var(--te-color-bg-muted);
    color: var(--te-color-fg-muted);
    font-family: var(--te-font-mono);
    font-size: 12.5px;
    line-height: 1.7;
    white-space: pre;
}

.home-features__snippet code {
    padding: 0;
    background: none;
    color: inherit;
    font-size: inherit;
}
</style>
