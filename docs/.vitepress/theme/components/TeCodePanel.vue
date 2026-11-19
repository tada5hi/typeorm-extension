<script setup lang="ts">
/* global HTMLElement, KeyboardEvent -- DOM types; ESLint's no-undef does not know them in .vue files. */
import { computed, ref, useId } from 'vue';
import { clampTabIndex, moveTabIndex } from '../tabs';

export type TeCodeTab = {
    label: string;
    code: string;
};

export type TeCodePanelProps = {
    title?: string;
    code?: string;
    tabs?: TeCodeTab[];
    /**
     * Index of the tab selected on first render. Only the initial value is
     * read: later changes are ignored, the user's selection wins.
     */
    active?: number;
};

const props = withDefaults(defineProps<TeCodePanelProps>(), {
    title: undefined,
    code: undefined,
    tabs: undefined,
    active: 0,
});

defineSlots<{ footer?: () => unknown }>();

const id = useId();
const selected = ref(props.active);

const tabCount = computed(() => props.tabs?.length ?? 0);
const hasTabs = computed(() => tabCount.value > 0);
const current = computed(() => clampTabIndex(selected.value, tabCount.value));

const lines = computed(() => {
    const source = hasTabs.value ?
        props.tabs?.[current.value]?.code ?? '' :
        props.code ?? '';

    // A trailing newline (YAML block scalars end with one) would add an empty numbered line.
    return source.replace(/\n$/, '').split('\n');
});

function tabId(index: number) {
    return `${id}-tab-${index}`;
}

function onKeydown(event: KeyboardEvent) {
    const next = moveTabIndex(event.key, current.value, tabCount.value);

    if (next === undefined) {
        return;
    }

    event.preventDefault();
    selected.value = next;

    const tablist = event.currentTarget as HTMLElement;

    tablist.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
}
</script>

<template>
    <div class="te-code-panel">
        <div
            v-if="hasTabs"
            class="te-code-panel__tabs"
        >
            <div
                class="te-code-panel__tablist"
                role="tablist"
                :aria-labelledby="title ? `${id}-title` : undefined"
                :aria-label="title ? undefined : 'Code examples'"
                @keydown="onKeydown"
            >
                <button
                    v-for="(tab, index) in tabs"
                    :id="tabId(index)"
                    :key="index"
                    type="button"
                    role="tab"
                    class="te-code-panel__tab"
                    :tabindex="index === current ? 0 : -1"
                    :aria-selected="index === current"
                    :aria-controls="`${id}-code`"
                    @click="selected = index"
                >
                    <span
                        class="te-code-panel__step"
                        aria-hidden="true"
                    >{{ index + 1 }}</span>{{ tab.label }}
                </button>
            </div>
            <span
                v-if="title"
                :id="`${id}-title`"
                class="te-code-panel__file"
                :title="title"
            >{{ title }}</span>
        </div>
        <div
            v-else-if="title"
            class="te-code-panel__bar"
        >
            {{ title }}
        </div>
        <pre
            :id="`${id}-code`"
            class="te-code-panel__code"
            tabindex="0"
            :role="hasTabs ? 'tabpanel' : undefined"
            :aria-labelledby="hasTabs ? tabId(current) : undefined"
        ><code><span
            v-for="(line, index) in lines"
            :key="index"
            class="te-code-panel__line"
        >{{ line || ' ' }}</span></code></pre>
        <div
            v-if="$slots.footer"
            class="te-code-panel__foot"
        >
            <slot name="footer" />
        </div>
    </div>
</template>
