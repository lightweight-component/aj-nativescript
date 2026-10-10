import { createApp } from 'nativescript-vue';
import { initGlobals } from './globals';
import Home from './components/Home.vue';

initGlobals();
createApp(Home).start();