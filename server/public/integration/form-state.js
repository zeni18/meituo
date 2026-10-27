/* Compare persisted form values, not the occurrence of browser input events. */
(() => {
  'use strict';
  function snapshot(container) {
    return JSON.stringify(Array.from(container.querySelectorAll('input,select,textarea'))
      .filter(control => control.name && !control.disabled && !['button','submit','reset'].includes(control.type))
      .map(control => [control.name, control.type === 'checkbox' || control.type === 'radio' ? control.checked : control.value]));
  }
  function track(container, onDirty) {
    let baseline = snapshot(container), disposed = false;
    const isDirty = () => snapshot(container) !== baseline;
    const refresh = () => { if (!disposed) onDirty(isDirty()); };
    const changed = () => queueMicrotask(refresh);
    container.addEventListener('input', changed);
    container.addEventListener('change', changed);
    return {
      isDirty, refresh,
      reset() { baseline = snapshot(container); refresh(); },
      destroy() { disposed = true; container.removeEventListener('input', changed); container.removeEventListener('change', changed); }
    };
  }
  window.IntegrationFormState = {snapshot, track};
})();
