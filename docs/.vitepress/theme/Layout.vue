<script setup lang="ts">
/* global document, HTMLElement, ResizeObserver, window */
import DefaultTheme from 'vitepress/theme';
import { onMounted, onUnmounted, ref } from 'vue';
import TeFooter from './components/TeFooter.vue';
import { footerVisibleHeight } from './footer-offset';

const DefaultLayout = DefaultTheme.Layout;

// The fixed sidebar ends at the footer's top edge (chrome.css reads
// --te-footer-visible), so the footer never hides sidebar entries.
const footer = ref<HTMLElement | null>(null);
let frame = 0;
let observer: ResizeObserver | undefined;

function update() {
    frame = 0;

    const top = footer.value?.firstElementChild?.getBoundingClientRect().top;
    const visible = typeof top === 'number' ? footerVisibleHeight(window.innerHeight, top) : 0;

    document.documentElement.style.setProperty('--te-footer-visible', `${visible}px`);
}

function schedule() {
    if (frame === 0) {
        frame = window.requestAnimationFrame(update);
    }
}

onMounted(() => {
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    // Page height changes without a scroll event on client-side navigation.
    observer = new ResizeObserver(schedule);
    observer.observe(document.body);
});

onUnmounted(() => {
    window.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    observer?.disconnect();

    if (frame !== 0) {
        window.cancelAnimationFrame(frame);
    }

    document.documentElement.style.removeProperty('--te-footer-visible');
});
</script>

<template>
    <DefaultLayout>
        <template #layout-bottom>
            <div ref="footer">
                <TeFooter />
            </div>
        </template>
    </DefaultLayout>
</template>
