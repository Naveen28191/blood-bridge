import { useEffect, useRef } from "react";
import { getSocket } from "./socket.js";

/** Subscribes to realtime updates for a single request (spec section 6). */
export function useRequestUpdates(requestId, onUpdate) {
  const cbRef = useRef(onUpdate);
  cbRef.current = onUpdate;

  useEffect(() => {
    if (!requestId) return;
    const socket = getSocket();
    socket.emit("join:request", requestId);

    const handler = (request) => {
      if (request.id === requestId) cbRef.current?.(request);
    };
    socket.on("request:update", handler);

    return () => {
      socket.emit("leave:request", requestId);
      socket.off("request:update", handler);
    };
  }, [requestId]);
}

/**
 * Subscribes to a source's whole inbox: any request update touching this
 * source (as destination or matched source), plus the specific
 * "request:matched" event that should trigger a prep-before-arrival alert.
 */
export function useSourceInbox(sourceId, { onUpdate, onMatched } = {}) {
  const updateRef = useRef(onUpdate);
  const matchedRef = useRef(onMatched);
  updateRef.current = onUpdate;
  matchedRef.current = onMatched;

  useEffect(() => {
    if (!sourceId) return;
    const socket = getSocket();
    socket.emit("join:source", sourceId);

    const updateHandler = (request) => updateRef.current?.(request);
    const matchedHandler = (request) => matchedRef.current?.(request);

    socket.on("request:update", updateHandler);
    socket.on("request:matched", matchedHandler);

    return () => {
      socket.off("request:update", updateHandler);
      socket.off("request:matched", matchedHandler);
    };
  }, [sourceId]);
}
