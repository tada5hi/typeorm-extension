import type { Theme } from 'vitepress';
import DefaultTheme from 'vitepress/theme';

import TeButton from './components/TeButton.vue';
import TeCard from './components/TeCard.vue';
import TeCodePanel from './components/TeCodePanel.vue';
import TeHeading from './components/TeHeading.vue';
import TeSection from './components/TeSection.vue';
import Layout from './Layout.vue';

import './styles/index.css';

export default {
    extends: DefaultTheme,
    Layout,
    enhanceApp({ app }) {
        app.component('TeButton', TeButton);
        app.component('TeCard', TeCard);
        app.component('TeCodePanel', TeCodePanel);
        app.component('TeHeading', TeHeading);
        app.component('TeSection', TeSection);
    },
} satisfies Theme;
