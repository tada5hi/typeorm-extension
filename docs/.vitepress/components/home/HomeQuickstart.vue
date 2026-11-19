<script setup lang="ts">
import { useData, withBase } from 'vitepress';
import { computed } from 'vue';

type QuickstartTab = {
    label: string;
    code: string;
};

type QuickstartFrontmatter = {
    eyebrow: string;
    title: string;
    lede: string;
    active: number;
    tabs: QuickstartTab[];
    link: { text: string; link: string };
};

const { frontmatter } = useData();

const quickstart = computed(() => frontmatter.value.quickstart as QuickstartFrontmatter);
</script>

<template>
    <TeSection
        surface="tinted"
        class="home-quickstart"
    >
        <div class="home-quickstart__split">
            <div class="home-quickstart__head">
                <TeHeading
                    :eyebrow="quickstart.eyebrow"
                    :title="quickstart.title"
                    :lede="quickstart.lede"
                />
                <a
                    class="home-quickstart__more"
                    :href="withBase(quickstart.link.link)"
                >
                    {{ quickstart.link.text }}
                    <span aria-hidden="true">→</span>
                </a>
            </div>

            <TeCodePanel
                :tabs="quickstart.tabs"
                :active="quickstart.active"
            />
        </div>
    </TeSection>
</template>

<style scoped>
.home-quickstart__split {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 40px;
    align-items: center;
}

.home-quickstart__split > * {
    min-width: 0;
}

@media (min-width: 1000px) {
    .home-quickstart__split {
        grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
        gap: 64px;
    }
}

.home-quickstart__head {
    display: grid;
    gap: 20px;
    justify-items: start;
}

.home-quickstart__more {
    color: var(--te-section-accent);
    font-size: 15px;
    font-weight: 500;
    text-decoration: none;
}

.home-quickstart__more:hover {
    text-decoration: underline;
    text-underline-offset: 4px;
}

.home-quickstart__more:focus-visible {
    outline: 2px solid var(--te-focus);
    outline-offset: 2px;
}
</style>
