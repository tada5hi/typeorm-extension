<script setup lang="ts">
import { useData, withBase } from 'vitepress';
import { computed, onBeforeUnmount, ref } from 'vue';

import InlineCode from './InlineCode.vue';

type HeroAction = {
    text: string;
    link: string;
};

type HeroFrontmatter = {
    eyebrow: { badge: string; text: string };
    title: string;
    highlight: string;
    description: string;
    actions: HeroAction[];
    install: string;
    meta: string;
    file: string;
    code: string;
};

const { frontmatter } = useData();

const hero = computed(() => frontmatter.value.hero as HeroFrontmatter);
const meta = computed(() => hero.value.meta.split('·').map((item) => item.trim()));

const copied = ref(false);
let copiedTimer: ReturnType<typeof setTimeout> | undefined;

async function copyInstall() {
    try {
        await navigator.clipboard.writeText(hero.value.install);
        copied.value = true;
        clearTimeout(copiedTimer);
        copiedTimer = setTimeout(() => {
            copied.value = false;
        }, 1500);
    } catch {
        // Clipboard access denied: the command stays selectable.
    }
}

onBeforeUnmount(() => {
    clearTimeout(copiedTimer);
});
</script>

<template>
    <TeSection
        surface="dark"
        class="home-hero"
    >
        <div class="home-hero__grid">
            <div class="home-hero__copy">
                <span class="home-hero__eyebrow"><b>{{ hero.eyebrow.badge }}</b> {{ hero.eyebrow.text }}</span>
                <h1 class="home-hero__title">
                    {{ hero.title }}<br><span class="home-hero__highlight">{{ hero.highlight }}</span>
                </h1>
                <p class="home-hero__lede">
                    <InlineCode :text="hero.description" />
                </p>
                <div class="home-hero__actions">
                    <TeButton
                        v-for="(action, index) in hero.actions"
                        :key="action.link"
                        :href="action.link"
                        :variant="index === 0 ? 'primary' : 'ghost'"
                    >
                        {{ action.text }}
                        <span
                            v-if="index === 0"
                            aria-hidden="true"
                        >→</span>
                    </TeButton>
                </div>
                <div class="home-hero__install">
                    <span><span
                        class="home-hero__prompt"
                        aria-hidden="true"
                    >$</span> {{ hero.install }}</span>
                    <button
                        class="home-hero__copy-button"
                        type="button"
                        :aria-label="copied ? 'Copied' : 'Copy install command'"
                        @click="copyInstall"
                    >
                        <svg
                            v-if="copied"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.8"
                            aria-hidden="true"
                        ><path d="M3 8.5 6.5 12 13 4.5" /></svg>
                        <svg
                            v-else
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            aria-hidden="true"
                        ><rect
                            x="5"
                            y="5"
                            width="8.5"
                            height="8.5"
                            rx="1.5"
                        /><path d="M10.5 5V3.5A1.5 1.5 0 0 0 9 2H3.5A1.5 1.5 0 0 0 2 3.5V9a1.5 1.5 0 0 0 1.5 1.5H5" /></svg>
                    </button>
                </div>
                <ul class="home-hero__meta">
                    <li
                        v-for="item in meta"
                        :key="item"
                    >
                        {{ item }}
                    </li>
                </ul>
            </div>

            <div class="home-hero__visual">
                <img
                    class="home-hero__mark"
                    :src="withBase('/logo.svg')"
                    alt=""
                    width="96"
                    height="96"
                >
                <TeCodePanel
                    class="home-hero__panel"
                    :title="hero.file"
                    :code="hero.code"
                />
            </div>
        </div>
    </TeSection>
</template>

<style scoped>
.home-hero {
    display: flex;
    align-items: center;
    min-height: min(calc(100vh - 120px), 880px);
    padding: calc(var(--te-nav-offset, 0px) + 56px) 0 64px;
}

.home-hero__grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 48px;
    align-items: center;
}

@media (min-width: 1040px) {
    .home-hero__grid {
        grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
        gap: 56px;
    }
}

.home-hero__copy {
    min-width: 0;
}

.home-hero__eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 5px 12px 5px 5px;
    border: 1px solid var(--te-border-on-dark-strong);
    border-radius: 999px;
    background: rgb(255 255 255 / 0.03);
    color: var(--te-on-dark-muted);
    font-family: var(--te-font-mono);
    font-size: 12.5px;
}

.home-hero__eyebrow b {
    padding: 2px 8px;
    border-radius: 999px;
    background: color-mix(in oklab, var(--te-color-primary-500) 22%, transparent);
    color: var(--te-color-primary-300);
    font-weight: 600;
}

.home-hero__title {
    margin: 26px 0 0;
    color: var(--te-on-dark);
    font-size: clamp(40px, 6.2vw, 68px);
    font-weight: 700;
    line-height: 1.04;
    letter-spacing: -0.035em;
}

.home-hero__highlight {
    background: var(--te-gradient-brand);
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
}

.home-hero__lede {
    max-width: 560px;
    margin: 24px 0 0;
    color: var(--te-on-dark-muted);
    font-size: 17px;
    line-height: 1.65;
}

.home-hero__lede :deep(code) {
    color: var(--te-on-dark);
    font-family: var(--te-font-mono);
    font-size: 0.9em;
}

.home-hero__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-top: 32px;
}

.home-hero__install {
    display: inline-flex;
    align-items: center;
    gap: 14px;
    max-width: 100%;
    margin-top: 22px;
    padding: 8px 8px 8px 16px;
    border: 1px solid var(--te-border-on-dark-strong);
    border-radius: 10px;
    background: rgb(0 0 0 / 0.2);
    color: var(--te-on-dark);
    font-family: var(--te-font-mono);
    font-size: 13.5px;
    box-sizing: border-box;
}

.home-hero__install > span {
    min-width: 0;
    overflow-x: auto;
    white-space: nowrap;
}

.home-hero__prompt {
    color: var(--te-color-primary-400);
}

.home-hero__copy-button {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: 1px solid var(--te-border-on-dark);
    border-radius: 7px;
    background: rgb(255 255 255 / 0.03);
    color: var(--te-on-dark-muted);
    cursor: pointer;
}

.home-hero__copy-button:hover {
    color: var(--te-on-dark);
}

.home-hero__copy-button:focus-visible {
    outline: 2px solid var(--te-color-primary-400);
    outline-offset: 2px;
}

.home-hero__copy-button svg {
    width: 15px;
    height: 15px;
}

.home-hero__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 14px;
    margin: 22px 0 0;
    padding: 0;
    color: var(--te-on-dark-faint);
    font-family: var(--te-font-mono);
    font-size: 12px;
    list-style: none;
}

.home-hero__meta li + li::before {
    margin-right: 14px;
    content: '·';
}

.home-hero__visual {
    position: relative;
    min-width: 0;
}

/* The logo sits on the panel's corner, half outside it. */
.home-hero__mark {
    position: absolute;
    top: -40px;
    right: -16px;
    z-index: 1;
    width: 96px;
    height: 96px;
    filter: drop-shadow(0 16px 32px rgb(0 0 0 / 0.45));
}

.home-hero__panel {
    box-shadow: 0 40px 80px -40px rgb(0 0 0 / 0.8), 0 0 0 1px rgb(14 165 233 / 0.08);
}

.home-hero__panel :deep(.te-code-panel__code) {
    font-size: clamp(11.5px, 1.25vw, 13px);
}

@media (max-width: 719px) {
    .home-hero {
        min-height: 0;
        padding: calc(var(--te-nav-offset, 0px) + 48px) 0 48px;
    }

    .home-hero__mark {
        top: -28px;
        right: 0;
        width: 64px;
        height: 64px;
    }
}
</style>
