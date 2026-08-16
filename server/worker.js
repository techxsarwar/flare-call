/**
 * FlareCall Cloudflare Worker - WebRTC Signaling Hub with Durable Objects
 * 
 * Developed by: Sarwar Altaf Dar <https://github.com/techxsarwar>
 * License: GNU General Public License v3.0 (GPL-3.0-or-later)
 */

export class CallRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.peers = new Map(); // peerId -> { ws, name, joinedAt, mediaState }
  }

  async fetch(request) {
    const url = new URL(request.url);
    const upgradeHeader = request.headers.get("Upgrade");

    if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    server.accept();
    this.handleSession(server);

    return new Response(null, {
      status: 101,
      webSocket: client
    });
  }

  handleSession(ws) {
    let currentPeerId = null;
    let peerName = "Anonymous";
    let currentRoomId = null;

    const send = (data) => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(typeof data === "string" ? data : JSON.stringify(data));
        }
      } catch (e) {
        console.error("[DO Signaling] Send error:", e);
      }
    };

    ws.addEventListener("message", (event) => {
      try {
        const raw = typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data);
        const msg = JSON.parse(raw);

        switch (msg.type) {
          case "ping":
            send({ type: "pong", timestamp: Date.now() });
            break;

          case "join": {
            const { roomId, peerId, name, mediaState } = msg;
            if (!peerId) return;

            currentRoomId = roomId;
            currentPeerId = peerId;
            peerName = name || "User " + peerId.substring(0, 4);

            const existingPeers = [];
            for (const [id, data] of this.peers.entries()) {
              if (id !== peerId) {
                existingPeers.push({
                  peerId: id,
                  name: data.name,
                  joinedAt: data.joinedAt,
                  mediaState: data.mediaState || { audio: true, video: true }
                });
              }
            }

            this.peers.set(peerId, {
              ws,
              name: peerName,
              joinedAt: Date.now(),
              mediaState: mediaState || { audio: true, video: true }
            });

            console.log(`[DO Signaling] Peer ${peerId} joined room ${roomId}. Total: ${this.peers.size}`);

            send({
              type: "joined",
              roomId,
              peerId,
              name: peerName,
              peers: existingPeers,
              timestamp: Date.now()
            });

            for (const [id, data] of this.peers.entries()) {
              if (id !== peerId && data.ws.readyState === WebSocket.OPEN) {
                try {
                  data.ws.send(JSON.stringify({
                    type: "peer-joined",
                    roomId,
                    peerId,
                    name: peerName,
                    mediaState: mediaState || { audio: true, video: true },
                    timestamp: Date.now()
                  }));
                } catch (err) {
                  console.error("[DO Signaling] Broadcast error:", err);
                }
              }
            }
            break;
          }

          case "offer":
          case "answer":
          case "ice-candidate": {
            const { targetPeerId, fromPeerId } = msg;
            if (!targetPeerId) return;
            const target = this.peers.get(targetPeerId);
            if (target && target.ws.readyState === WebSocket.OPEN) {
              target.ws.send(JSON.stringify({
                ...msg,
                fromPeerId: fromPeerId || currentPeerId,
                fromName: peerName
              }));
            }
            break;
          }

          case "media-state": {
            const { mediaState } = msg;
            if (!currentPeerId) return;
            const peer = this.peers.get(currentPeerId);
            if (peer) peer.mediaState = mediaState;

            for (const [id, data] of this.peers.entries()) {
              if (id !== currentPeerId && data.ws.readyState === WebSocket.OPEN) {
                data.ws.send(JSON.stringify({
                  type: "peer-media-state",
                  roomId: currentRoomId,
                  peerId: currentPeerId,
                  mediaState
                }));
              }
            }
            break;
          }

          case "chat": {
            const { text, timestamp } = msg;
            const chatPayload = JSON.stringify({
              type: "chat",
              roomId: currentRoomId,
              fromPeerId: currentPeerId,
              fromName: peerName,
              text,
              timestamp: timestamp || Date.now()
            });

            for (const [id, data] of this.peers.entries()) {
              if (data.ws.readyState === WebSocket.OPEN) {
                data.ws.send(chatPayload);
              }
            }
            break;
          }

          case "leave":
            cleanup();
            break;
        }
      } catch (err) {
        console.error("[DO Signaling] Message error:", err);
      }
    });

    const cleanup = () => {
      if (currentPeerId) {
        this.peers.delete(currentPeerId);
        for (const [id, data] of this.peers.entries()) {
          if (data.ws.readyState === WebSocket.OPEN) {
            try {
              data.ws.send(JSON.stringify({
                type: "peer-left",
                roomId: currentRoomId,
                peerId: currentPeerId,
                name: peerName,
                timestamp: Date.now()
              }));
            } catch (err) {
              console.error("[DO Signaling] Leave notify error:", err);
            }
          }
        }
        currentPeerId = null;
      }
    };

    ws.addEventListener("close", cleanup);
    ws.addEventListener("error", cleanup);
  }
}

const fallbackRooms = new Map();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({
        status: "healthy",
        author: "Sarwar Altaf Dar",
        license: "GPL-3.0-or-later",
        service: "FlareCall Cloudflare Durable Object Signaling Worker"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (url.pathname === "/ws" || url.pathname === "/signaling") {
      if (env.CALL_ROOMS) {
        const roomId = url.searchParams.get("room") || "default-room";
        const id = env.CALL_ROOMS.idFromName(roomId);
        const obj = env.CALL_ROOMS.get(id);
        return obj.fetch(request);
      }

      // In-memory fallback if DO is not provisioned
      const upgradeHeader = request.headers.get("Upgrade");
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426, headers: corsHeaders });
      }

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);
      server.accept();
      handleFallbackSession(server);
      return new Response(null, { status: 101, webSocket: client, headers: corsHeaders });
    }

    return new Response("FlareCall Signaling Worker Online", { headers: corsHeaders });
  }
};

function handleFallbackSession(ws) {
  let currentRoomId = null;
  let currentPeerId = null;
  let peerName = "Anonymous";

  const send = (data) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(typeof data === "string" ? data : JSON.stringify(data));
      }
    } catch (e) {}
  };

  ws.addEventListener("message", (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === "join") {
        const { roomId, peerId, name, mediaState } = msg;
        currentRoomId = roomId;
        currentPeerId = peerId;
        peerName = name;
        if (!fallbackRooms.has(roomId)) fallbackRooms.set(roomId, new Map());
        const room = fallbackRooms.get(roomId);
        const peers = [];
        for (const [id, data] of room.entries()) {
          if (id !== peerId) peers.push({ peerId: id, name: data.name, joinedAt: data.joinedAt, mediaState: data.mediaState });
        }
        room.set(peerId, { ws, name, joinedAt: Date.now(), mediaState });
        send({ type: "joined", roomId, peerId, name, peers, timestamp: Date.now() });
        for (const [id, data] of room.entries()) {
          if (id !== peerId && data.ws.readyState === WebSocket.OPEN) {
            data.ws.send(JSON.stringify({ type: "peer-joined", roomId, peerId, name, mediaState, timestamp: Date.now() }));
          }
        }
      } else if (msg.type === "offer" || msg.type === "answer" || msg.type === "ice-candidate") {
        const room = fallbackRooms.get(msg.roomId || currentRoomId);
        if (room && room.has(msg.targetPeerId)) {
          const target = room.get(msg.targetPeerId);
          if (target && target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(JSON.stringify({ ...msg, fromPeerId: currentPeerId, fromName: peerName }));
          }
        }
      }
    } catch (e) {}
  });

  const cleanup = () => {
    if (currentRoomId && currentPeerId) {
      const room = fallbackRooms.get(currentRoomId);
      if (room) {
        room.delete(currentPeerId);
        for (const [id, data] of room.entries()) {
          if (data.ws.readyState === WebSocket.OPEN) {
            data.ws.send(JSON.stringify({ type: "peer-left", roomId: currentRoomId, peerId: currentPeerId, name: peerName }));
          }
        }
      }
    }
  };

  ws.addEventListener("close", cleanup);
  ws.addEventListener("error", cleanup);
}
