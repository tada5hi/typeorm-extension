<script setup lang="ts">
import { useData, withBase } from 'vitepress';
import { computed } from 'vue';
import { resolveFooter } from '../footer';
import { isExternalLink } from '../links';

const { site, theme } = useData();

const footer = computed(() => resolveFooter(theme.value));
const gridStyle = computed(() => ({ '--te-footer-columns': footer.value?.columns.length ?? 0 }));

function toHref(link: string) {
    return isExternalLink(link) ? link : withBase(link);
}
</script>

<template>
    <footer
        v-if="footer"
        class="te-footer"
    >
        <div class="te-container">
            <div
                class="te-footer__grid"
                :style="gridStyle"
            >
                <div class="te-footer__brand">
                    <a
                        class="te-footer__home"
                        :href="withBase('/')"
                    >
                        <img
                            class="te-footer__logo"
                            :src="withBase('/logo.svg')"
                            alt=""
                            width="28"
                            height="28"
                        >
                        <span>{{ site.title }}</span>
                    </a>
                    <p class="te-footer__tagline">
                        {{ footer.tagline }}
                    </p>
                </div>
                <nav
                    v-for="(column, columnIndex) in footer.columns"
                    :key="`${columnIndex}-${column.title}`"
                    class="te-footer__column"
                    :aria-label="column.title"
                >
                    <h2 class="te-footer__title">
                        {{ column.title }}
                    </h2>
                    <ul class="te-footer__links">
                        <li
                            v-for="(item, itemIndex) in column.links"
                            :key="`${itemIndex}-${item.link}`"
                        >
                            <a
                                :href="toHref(item.link)"
                                :target="isExternalLink(item.link) ? '_blank' : undefined"
                                :rel="isExternalLink(item.link) ? 'noopener' : undefined"
                            >{{ item.text }}</a>
                        </li>
                    </ul>
                </nav>
            </div>
            <div
                v-if="footer.note"
                class="te-footer__bottom"
            >
                <span>{{ footer.note }}</span>
            </div>
        </div>
    </footer>
</template>
