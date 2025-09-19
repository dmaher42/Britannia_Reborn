const DEFAULTS = {
  selector: '[data-tip], .action-btn',
  delay: 180,
  offset: 8,
  useDataset: true,
  tipMap: {}
};
const TOOLTIP_ROOT_ID = 'tooltip-root';
const TOOLTIP_ID = 'ui-tooltip-bubble';
const FOCUS_KEYS = new Set(['Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown']);
// Internal state for tooltip configuration and active trigger tracking.
const state = {
  config: { ...DEFAULTS, tipMap: {} },
  bubble: null,
  active: null,
  pending: null,
  timer: 0,
  focusLocked: false,
  lastPointer: 'mouse',
  hadKeyboard: false,
  touchBlockClick: false,
  initialized: false,
  custom: new WeakMap()
};
function ensureDom() {
  let root = document.getElementById(TOOLTIP_ROOT_ID);
  if (!root) {
    root = document.createElement('div');
    root.id = TOOLTIP_ROOT_ID;
    root.setAttribute('aria-hidden', 'true');
    document.body.appendChild(root);
  }
  let bubble = document.getElementById(TOOLTIP_ID);
  if (!bubble) {
    bubble = document.createElement('div');
    bubble.id = TOOLTIP_ID;
    bubble.className = 'ui-tooltip';
    bubble.setAttribute('role', 'tooltip');
    bubble.dataset.state = 'hidden';
    bubble.setAttribute('aria-hidden', 'true');
    root.appendChild(bubble);
  }
  state.bubble = bubble;
}
const cancelTimer = () => {
  if (state.timer) {
    window.clearTimeout(state.timer);
    state.timer = 0;
  }
  state.pending = null;
};
const getTrigger = (target) => (target && typeof target.closest === 'function' && state.config.selector ? target.closest(state.config.selector) : null);
const toText = (value) => (typeof value === 'string' ? value.trim() : '');
function resolveText(element) {
  if (!element) return '';
  const override = toText(state.custom.get(element));
  if (override) return override;
  const id = element.id;
  if (id) {
    const mapped = toText(state.config.tipMap?.[id]);
    if (mapped) return mapped;
  }
  if (state.config.useDataset) {
    const datasetTip = toText(element.dataset?.tip);
    if (datasetTip) return datasetTip;
  }
  return '';
}
function updateAria(target, add) {
  if (!state.bubble || !target) return;
  const id = state.bubble.id;
  const existing = target.getAttribute('aria-describedby');
  const tokens = existing ? existing.split(/\s+/).filter(Boolean) : [];
  const has = tokens.includes(id);
  if (add) {
    if (!has) {
      tokens.push(id);
      target.setAttribute('aria-describedby', tokens.join(' '));
    }
  } else if (has) {
    const next = tokens.filter((token) => token !== id);
    if (next.length) {
      target.setAttribute('aria-describedby', next.join(' '));
    } else {
      target.removeAttribute('aria-describedby');
    }
  }
}
function positionTooltip(target) {
  const bubble = state.bubble, rect = target?.getBoundingClientRect();
  if (!bubble || !rect || (!rect.width && !rect.height)) return;
  const margin = 8, offset = Number.isFinite(state.config.offset) ? state.config.offset : DEFAULTS.offset;
  bubble.style.cssText = 'left:0;top:0;visibility:hidden;'; bubble.dataset.placement = 'top';
  const tipRect = bubble.getBoundingClientRect(), viewportW = window.innerWidth ?? document.documentElement?.clientWidth ?? tipRect.width, viewportH = window.innerHeight ?? document.documentElement?.clientHeight ?? tipRect.height;
  let placement = 'top', top = rect.top - tipRect.height - offset;
  if (top < margin) { placement = 'bottom'; const maxTop = viewportH - tipRect.height - margin; top = Math.min(Math.max(rect.bottom + offset, margin), maxTop); } else top = Math.max(top, margin);
  let left = rect.left + rect.width / 2 - tipRect.width / 2; const maxLeft = viewportW - tipRect.width - margin;
  left = Math.min(Math.max(left, margin), maxLeft);
  bubble.style.left = `${Math.round(left)}px`; bubble.style.top = `${Math.round(top)}px`; bubble.dataset.placement = placement; bubble.style.visibility = '';
}
function hideTooltip(target = state.active) {
  const bubble = state.bubble;
  if (!bubble || (target && target !== state.active)) return;
  cancelTimer();
  if (state.active) updateAria(state.active, false);
  bubble.classList.remove('ui-tooltip--visible');
  bubble.dataset.state = 'hidden';
  bubble.setAttribute('aria-hidden', 'true');
  bubble.style.cssText = 'left:-9999px;top:-9999px;visibility:hidden;';
  bubble.removeAttribute('data-placement');
  state.active = null;
  state.focusLocked = false;
  state.touchBlockClick = false;
}
function showTooltip(target, focus = false) {
  if (!state.bubble || !target?.isConnected) return;
  const text = resolveText(target);
  if (!text) return;
  cancelTimer();
  state.bubble.textContent = text;
  state.bubble.dataset.state = 'visible';
  state.bubble.classList.remove('ui-tooltip--visible');
  state.bubble.setAttribute('aria-hidden', 'false');
  positionTooltip(target);
  window.requestAnimationFrame(() => {
    if (state.bubble) state.bubble.classList.add('ui-tooltip--visible');
  });
  if (state.active && state.active !== target) updateAria(state.active, false);
  state.active = target;
  state.focusLocked = focus;
  updateAria(target, true);
}
function scheduleShow(target, { immediate = false, focus = false } = {}) {
  cancelTimer();
  if (!target) return;
  if (immediate || state.config.delay === 0) {
    showTooltip(target, focus);
    return;
  }
  state.pending = target;
  state.timer = window.setTimeout(() => {
    state.timer = 0;
    const pending = state.pending;
    state.pending = null;
    if (pending === target) showTooltip(target, focus);
  }, state.config.delay);
}
// Pointer event handler manages hover, press, and touch activation.
const handlePointer = (event) => {
  const trigger = getTrigger(event.target);
  if (event.type === 'pointerdown') {
    state.lastPointer = event.pointerType || 'mouse';
    state.hadKeyboard = false;
    const text = trigger ? resolveText(trigger) : '';
    cancelTimer();
    if (state.lastPointer === 'touch') {
      if (trigger && text) {
        if (state.active === trigger && state.bubble?.dataset.state === 'visible') {
          state.touchBlockClick = false;
        } else {
          scheduleShow(trigger, { immediate: true, focus: false });
          state.touchBlockClick = true;
        }
      } else {
        state.touchBlockClick = false;
        if (!state.focusLocked) hideTooltip();
      }
      return;
    }
    if ((!trigger || !text) && !state.focusLocked) hideTooltip();
    return;
  }
  if (!trigger) return;
  if (event.type === 'pointerenter') {
    const text = resolveText(trigger);
    if (!text) {
      if (!state.focusLocked || state.active !== trigger) hideTooltip();
      return;
    }
    if (state.focusLocked && state.active && state.active !== trigger) return;
    state.lastPointer = event.pointerType || 'mouse';
    if (state.lastPointer === 'touch') return;
    if (state.active && state.active !== trigger && !state.focusLocked) hideTooltip();
    scheduleShow(trigger, { focus: false });
  } else {
    if (state.lastPointer === 'touch') return;
    if (state.pending === trigger) cancelTimer();
    if (state.focusLocked && state.active === trigger) return;
    if (state.active === trigger) hideTooltip();
  }
};
const handleClick = (event) => {
  if (state.lastPointer !== 'touch' || !state.touchBlockClick) return;
  const trigger = getTrigger(event.target);
  if (trigger && trigger === state.active) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }
  state.touchBlockClick = false;
};
// Keyboard focus support ensures tooltips lock to focused controls.
const handleFocus = (event) => {
  const trigger = getTrigger(event.target);
  if (!trigger) return;
  if (event.type === 'focusin') {
    if (!resolveText(trigger)) return;
    const focusVisible = typeof trigger.matches === 'function' && trigger.matches(':focus-visible');
    if (!state.hadKeyboard && !focusVisible) return;
    scheduleShow(trigger, { immediate: true, focus: true });
  } else {
    if (state.pending === trigger) cancelTimer();
    if (state.active === trigger) hideTooltip();
  }
};
const handleKeyDown = (event) => {
  if (event.key === 'Escape') {
    hideTooltip();
    return;
  }
  if (FOCUS_KEYS.has(event.key) || event.key === 'Enter' || (event.key === ' ' && event.target instanceof HTMLElement && event.target.tabIndex >= 0)) {
    state.hadKeyboard = true;
  }
};
const handleViewportChange = () => {
  if (!state.active || state.bubble?.dataset.state !== 'visible') return;
  if (!state.active.isConnected) {
    hideTooltip();
    return;
  }
  positionTooltip(state.active);
};
export function initTooltips(options = {}) {
  const selector = typeof options.selector === 'string' && options.selector.trim() ? options.selector.trim() : DEFAULTS.selector;
  state.config.selector = selector;
  state.config.delay = Number.isFinite(options.delay) ? Math.max(0, options.delay) : DEFAULTS.delay;
  state.config.offset = Number.isFinite(options.offset) ? options.offset : DEFAULTS.offset;
  state.config.useDataset = options.useDataset === undefined ? DEFAULTS.useDataset : !!options.useDataset;
  state.config.tipMap = options.tipMap && typeof options.tipMap === 'object' ? { ...options.tipMap } : {};
  ensureDom();
  if (!state.initialized) {
    document.addEventListener('pointerenter', handlePointer, true);
    document.addEventListener('pointerleave', handlePointer, true);
    document.addEventListener('pointerdown', handlePointer, true);
    document.addEventListener('pointercancel', cancelTimer, true);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('focusin', handleFocus, true);
    document.addEventListener('focusout', handleFocus, true);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('resize', handleViewportChange, { passive: true });
    window.addEventListener('scroll', handleViewportChange, true);
    state.initialized = true;
  }
  return state.bubble;
}
export function setTooltipContent(element, text) {
  if (!(element instanceof Element)) return;
  const value = typeof text === 'string' ? text.trim() : '';
  if (value) {
    state.custom.set(element, value);
    if (state.config.useDataset && element.dataset) element.dataset.tip = value;
  } else {
    state.custom.delete(element);
    if (state.config.useDataset && element.dataset) delete element.dataset.tip;
  }
  if (state.active === element && state.bubble?.dataset.state === 'visible') {
    const resolved = value || resolveText(element);
    if (resolved) {
      state.bubble.textContent = resolved;
      positionTooltip(element);
    } else {
      hideTooltip();
    }
  }
}
export function hideAllTooltips() {
  hideTooltip();
}
