import './local-dev';
import './styles.css';
import { mount } from './app';
const dispose = mount();
import.meta.hot?.dispose(dispose);
