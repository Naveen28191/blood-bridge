import { io } from "socket.io-client";
import { api } from "./api.js";

let socket = null;

/** Lazily-created singleton socket, shared across the app. */
export function getSocket() {
  if (!socket) {
    socket = io(api.BASE_URL, { autoConnect: true, transports: ["websocket", "polling"] });
  }
  return socket;
}
