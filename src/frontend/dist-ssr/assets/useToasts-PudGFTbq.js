import { s as useToastsStore } from '../ssr-entry-server.js';

function useToasts() {
  const store = useToastsStore();
  function push(message, type = "info", timeoutMs) {
    return store.pushToast({ type, message, timeoutMs });
  }
  function success(message, timeoutMs) {
    return push(message, "success", timeoutMs);
  }
  function error(message, timeoutMs) {
    return push(message, "error", timeoutMs);
  }
  function info(message, timeoutMs) {
    return push(message, "info", timeoutMs);
  }
  function warning(message, timeoutMs) {
    return push(message, "warning", timeoutMs);
  }
  function badge(badgePayload, timeoutMs) {
    const message = badgePayload?.title || "You earned a badge!";
    return store.pushToast({ type: "info", message, timeoutMs, payload: { kind: "badge", badge: badgePayload } });
  }
  return {
    push,
    success,
    error,
    info,
    warning,
    badge,
    remove: store.removeToast,
    clear: store.clear
  };
}

export { useToasts as u };
//# sourceMappingURL=useToasts-PudGFTbq.js.map
