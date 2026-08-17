// Realtime layer for BloodBridge.
//
// MVP NOTE: spec section 6 asks for "Firestore listeners (or WebSocket if
// not using Firebase)" — this is the WebSocket branch, via Socket.io, since
// we're not pointed at a live Firestore project. The room/event shape below
// is deliberately close to what Firestore `onSnapshot` listeners would
// deliver (one room per request doc, one room per source's inbox) so the
// swap later is additive, not a redesign.
//
// Rooms:
//   request:{requestId}  - anyone watching one request (ambulance + the
//                           matched/destination source's dashboard)
//   source:{sourceId}    - a source's whole inbox, for "new request matched
//                           to me" / "prep before arrival" without already
//                           knowing the request id
//
// Server -> client events:
//   request:update  - full request doc, whenever anything about it changes
//   request:matched - fired specifically when matchedSourceId is (re)set,
//                      to the newly matched source's inbox room — this is
//                      what drives the "prep before arrival" banner

let ioRef = null;

export function initSocket(io) {
  ioRef = io;

  io.on("connection", (socket) => {
    socket.on("join:request", (requestId) => {
      if (typeof requestId === "string") socket.join(`request:${requestId}`);
    });

    socket.on("join:source", (sourceId) => {
      if (typeof sourceId === "string") socket.join(`source:${sourceId}`);
    });

    socket.on("leave:request", (requestId) => {
      if (typeof requestId === "string") socket.leave(`request:${requestId}`);
    });
  });
}

export function emitRequestUpdate(request) {
  if (!ioRef) return;
  ioRef.to(`request:${request.id}`).emit("request:update", request);
  // Also nudge the destination hospital's inbox so its dashboard list
  // re-renders even if it hasn't joined this specific request room yet.
  ioRef.to(`source:${request.destinationHospitalId}`).emit("request:update", request);
  if (request.matchedSourceId) {
    ioRef.to(`source:${request.matchedSourceId}`).emit("request:update", request);
  }
}

export function emitRequestMatched(request) {
  if (!ioRef || !request.matchedSourceId) return;
  ioRef.to(`source:${request.matchedSourceId}`).emit("request:matched", request);
}
