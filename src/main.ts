import './styles/tokens.css';
import './styles/base.css';
import './styles/motion.css';
import { mount } from 'svelte';
import BuildTest from './screens/build-test/BuildTest.svelte';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
}

mount(BuildTest, { target: document.getElementById('app')! });
