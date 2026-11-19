// The script build (dist/auto.global.js): registers the elements as soon as it loads, and puts the SDK
// on window.liaElements (never window.Lia, which belongs to the script tag SDK).
import { defineLiaElements } from './index';

defineLiaElements();

export * from './index';
