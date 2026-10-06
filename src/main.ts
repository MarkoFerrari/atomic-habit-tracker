import './styles/tokens.css';
import './styles/base.css';
import './styles/motion.css';
import { mount } from 'svelte';
import BuildTest from './screens/build-test/BuildTest.svelte';
import Gallery from './screens/gallery/Gallery.svelte';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
}

// M1: the component gallery lives at #gallery until the real screens replace the build test (M2).
const screen = location.hash === '#gallery' ? Gallery : BuildTest;
mount(screen, { target: document.getElementById('app')! });
