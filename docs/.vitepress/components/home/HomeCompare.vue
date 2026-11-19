<script setup lang="ts">
import { useData } from 'vitepress';
import { computed } from 'vue';

import InlineCode from './InlineCode.vue';

type CompareRow = {
    concern: string;
    without: string;
    with: string;
};

type CompareFrontmatter = {
    eyebrow: string;
    title: string;
    lede: string;
    columns: {
        concern: string; 
        without: string; 
        with: string 
    };
    rows: CompareRow[];
};

const { frontmatter } = useData();

const compare = computed(() => frontmatter.value.compare as CompareFrontmatter);
</script>

<template>
    <TeSection class="home-compare">
        <TeHeading
            :eyebrow="compare.eyebrow"
            :title="compare.title"
            :lede="compare.lede"
        />
        <div
            class="home-compare__table"
            role="table"
            :aria-label="compare.title"
        >
            <div
                class="home-compare__row home-compare__row--head"
                role="row"
            >
                <span role="columnheader">{{ compare.columns.concern }}</span>
                <span role="columnheader">{{ compare.columns.without }}</span>
                <span role="columnheader">{{ compare.columns.with }}</span>
            </div>
            <div
                v-for="row in compare.rows"
                :key="row.concern"
                class="home-compare__row"
                role="row"
            >
                <span
                    class="home-compare__concern"
                    role="rowheader"
                >{{ row.concern }}</span>
                <span
                    class="home-compare__without"
                    role="cell"
                    :data-label="compare.columns.without"
                ><InlineCode :text="row.without" /></span>
                <span
                    class="home-compare__with"
                    role="cell"
                    :data-label="compare.columns.with"
                ><InlineCode :text="row.with" /></span>
            </div>
        </div>
    </TeSection>
</template>

<style scoped>
.home-compare__table {
    margin-top: 44px;
    overflow: hidden;
    border: 1px solid var(--te-color-border);
    border-radius: 14px;
}

.home-compare__row {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    padding: 18px 20px;
    font-size: 15px;
    line-height: 1.55;
}

.home-compare__row + .home-compare__row {
    border-top: 1px solid var(--te-color-border);
}

/* Below 860px the header row is hidden, and each cell names its column. */
.home-compare__row--head {
    display: none;
}

.home-compare__row--head + .home-compare__row {
    border-top: 0;
}

@media (min-width: 860px) {
    .home-compare__row {
        grid-template-columns: minmax(0, 0.7fr) minmax(0, 1.15fr) minmax(0, 1.15fr);
        gap: 24px;
    }

    .home-compare__row--head {
        display: grid;
        background: var(--te-color-bg-elevated);
        color: var(--te-color-fg-muted);
        font-family: var(--te-font-mono);
        font-size: 11px;
        letter-spacing: 0.1em;
        text-transform: uppercase;
    }

    .home-compare__row--head + .home-compare__row {
        border-top: 1px solid var(--te-color-border);
    }
}

.home-compare__concern {
    color: var(--te-color-fg);
    font-weight: 600;
}

.home-compare__without {
    color: var(--te-color-fg-muted);
}

.home-compare__with {
    color: var(--te-color-fg);
}

/* Below 860px the column headers are hidden, so each cell names its column. */
@media (max-width: 859px) {
    .home-compare__without::before,
    .home-compare__with::before {
        display: block;
        margin-bottom: 2px;
        color: var(--te-color-fg-muted);
        font-family: var(--te-font-mono);
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        content: attr(data-label);
    }
}

.home-compare__with::before {
    color: var(--te-color-primary-text);
}

.home-compare__row :deep(code) {
    font-family: var(--te-font-mono);
    font-size: 0.88em;
}

.home-compare__with :deep(code) {
    color: var(--te-color-primary-text);
}
</style>
