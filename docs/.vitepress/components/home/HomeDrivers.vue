<script setup lang="ts">
import { useData } from 'vitepress';
import { computed } from 'vue';

type DriversFrontmatter = {
    label: string;
    items: string[];
};

const { frontmatter } = useData();

const drivers = computed(() => frontmatter.value.drivers as DriversFrontmatter);
</script>

<template>
    <div class="home-drivers">
        <div class="te-container home-drivers__row">
            <span class="home-drivers__label">{{ drivers.label }}</span>
            <ul class="home-drivers__list">
                <li
                    v-for="item in drivers.items"
                    :key="item"
                >
                    {{ item }}
                </li>
            </ul>
        </div>
    </div>
</template>

<style scoped>
.home-drivers {
    border-bottom: 1px solid var(--te-color-border);
    background: var(--te-color-bg);
}

.home-drivers__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 14px 24px;
    padding-top: 22px;
    padding-bottom: 22px;
}

.home-drivers__label {
    color: var(--te-color-fg-muted);
    font-family: var(--te-font-mono);
    font-size: 11px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
}

.home-drivers__list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
}

.home-drivers__list li {
    padding: 4px 10px;
    border: 1px solid var(--te-color-border);
    border-radius: 999px;
    background: var(--te-color-bg-elevated);
    color: var(--te-color-fg);
    font-family: var(--te-font-mono);
    font-size: 12.5px;
}
</style>
