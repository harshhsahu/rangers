/**
 * Minimal global guard for unsaved prompt changes.
 * Components write to this; navigation interceptors read from it.
 *
 * Supports useSyncExternalStore so any component can reactively
 * subscribe to hasUnsavedChanges without prop drilling.
 */

let _hasUnsavedChanges = false;
const _listeners = new Set();

function notifyListeners() {
  _listeners.forEach((fn) => fn());
}

const guard = {
  get hasUnsavedChanges() {
    return _hasUnsavedChanges;
  },
  set hasUnsavedChanges(value) {
    if (_hasUnsavedChanges !== value) {
      _hasUnsavedChanges = value;
      notifyListeners();
    }
  },

  // useSyncExternalStore interface
  subscribe(listener) {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },
  getSnapshot() {
    return _hasUnsavedChanges;
  },
};

export default guard;
