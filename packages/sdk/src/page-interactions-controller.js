// Mirrored by lia-api/src/sdk/page-interactions.ts. No native bridge calls.
export function pageInteractions() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return null;
  var key = Symbol.for('lia.pageInteractions.v1');
  if (window[key]) return window[key];
  var options = { zoom: false, textSelection: false, contextMenu: false, nativeDrag: false };
  var viewport = null, originalViewport = null, createdViewport = false;
  var root = document.documentElement;
  function editable(event) {
    var node = event.target;
    if (node && node.nodeType !== 1) node = node.parentElement;
    if (!node || !node.closest) return false;
    var field = node.closest('input,textarea,select,[contenteditable]');
    return Boolean(field && (field.matches('input,textarea,select') || field.getAttribute('contenteditable') !== 'false'));
  }
  var style = document.createElement('style');
  style.setAttribute('data-lia-page-interactions', '');
  style.textContent =
    'html[data-lia-selection="off"] body,html[data-lia-selection="off"] body *{-webkit-user-select:none!important;user-select:none!important}' +
    'html[data-lia-menu="off"] body,html[data-lia-menu="off"] body *{-webkit-touch-callout:none!important}' +
    'html[data-lia-selection="off"] body input,html[data-lia-selection="off"] body textarea,html[data-lia-selection="off"] body [contenteditable]:not([contenteditable="false"]),html[data-lia-selection="off"] body [contenteditable]:not([contenteditable="false"]) *{-webkit-user-select:text!important;user-select:text!important}' +
    'html[data-lia-menu="off"] body input,html[data-lia-menu="off"] body textarea,html[data-lia-menu="off"] body [contenteditable]:not([contenteditable="false"]),html[data-lia-menu="off"] body [contenteditable]:not([contenteditable="false"]) *{-webkit-touch-callout:default!important}' +
    'html[data-lia-zoom="off"],:where(html[data-lia-zoom="off"]) :where(*){touch-action:pan-x pan-y}' +
    'html[data-lia-drag="off"] body img,html[data-lia-drag="off"] body a{-webkit-user-drag:none!important}';
  (document.head || root).appendChild(style);
  function apply() {
    root.setAttribute('data-lia-selection', options.textSelection ? 'on' : 'off');
    root.setAttribute('data-lia-menu', options.contextMenu ? 'on' : 'off');
    root.setAttribute('data-lia-drag', options.nativeDrag ? 'on' : 'off');
    root.setAttribute('data-lia-zoom', options.zoom ? 'on' : 'off');
    if (!options.zoom) {
      if (!viewport) {
        viewport = document.querySelector('meta[name="viewport"]');
        createdViewport = !viewport;
        if (!viewport) { viewport = document.createElement('meta'); viewport.name = 'viewport'; (document.head || root).appendChild(viewport); }
        originalViewport = viewport.getAttribute('content');
      }
      var base = (originalViewport || 'width=device-width, initial-scale=1').split(',').filter(function (part) {
        return !/^\s*(maximum-scale|minimum-scale|user-scalable)\s*=/i.test(part);
      }).join(',');
      viewport.setAttribute('content', base + ', maximum-scale=1, minimum-scale=1, user-scalable=no');
    } else if (viewport) {
      if (createdViewport) viewport.remove();
      else if (originalViewport === null) viewport.removeAttribute('content');
      else viewport.setAttribute('content', originalViewport);
      viewport = null;
    }
  }
  function cancel(event) { if (event.cancelable) event.preventDefault(); }
  document.addEventListener('selectstart', function (event) { if (!options.textSelection && !editable(event)) cancel(event); }, true);
  document.addEventListener('contextmenu', function (event) { if (!options.contextMenu && !editable(event)) cancel(event); }, true);
  document.addEventListener('dragstart', function (event) { if (!options.nativeDrag && !editable(event)) cancel(event); }, true);
  ['gesturestart', 'gesturechange'].forEach(function (name) {
    document.addEventListener(name, function (event) { if (!options.zoom) cancel(event); }, { passive: false });
  });
  // No touchstart/touchmove listeners: a non-passive one makes the phone wait for the page's JavaScript before
  // every scroll step (scrolling lags, worst in busy games). Pinch zoom is already off through the viewport,
  // touch-action (below, at zero specificity so an app's own touch-action wins) and gesturestart on iOS.
  document.addEventListener('wheel', function (event) { if (!options.zoom && (event.ctrlKey || event.metaKey)) cancel(event); }, { passive: false });
  document.addEventListener('keydown', function (event) {
    if (!(event.ctrlKey || event.metaKey) || editable(event)) return;
    if ((!options.textSelection && event.key.toLowerCase() === 'a') || (!options.zoom && ['+', '-', '=', '0'].indexOf(event.key) !== -1)) cancel(event);
  }, true);
  function get() { return Object.assign({}, options); }
  function set(next) {
    if (!next || typeof next !== 'object' || Array.isArray(next)) throw new TypeError('Pass page interaction options.');
    Object.keys(next).forEach(function (name) {
      if (!Object.prototype.hasOwnProperty.call(options, name) || typeof next[name] !== 'boolean') throw new TypeError('Unknown interaction or non-boolean value: ' + name);
    });
    Object.assign(options, next); apply(); return get();
  }
  var controller = { get: get, set: set };
  window[key] = controller;
  apply();
  // Scripts placed before the viewport meta still protect the authored viewport once the head is parsed.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () {
    if (createdViewport && !options.zoom) {
      var authored = Array.prototype.find.call(document.querySelectorAll('meta[name="viewport"]'), function (meta) { return meta !== viewport; });
      if (authored) { viewport.remove(); viewport = null; apply(); }
    }
  }, { once: true });
  return controller;
}
