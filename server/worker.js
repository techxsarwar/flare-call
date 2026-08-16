/**
 * FlareCall Cloudflare Worker - WebRTC Signaling & Room Management
 * 
 * Provides ultra-low latency WebSocket signaling for WebRTC peer-to-peer audio/video calls.
 * Works seamlessly with Web (React/Vite), Mobile (React Native/Android), and Native Java clients.
 */

// In-memory active rooms registry
// Map<roomId, Map<peerId, { ws: WebSocket, name: string, joinedAt: number, mediaState: object }>>
const rooms = new Map();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Standard CORS headers for all incoming HTTP requests
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Upgrade, Sec-WebSocket-Key, Sec-WebSocket-Version, Sec-WebSocket-Protocol",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Health check endpoint
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({
        status: "healthy",
        timestamp: new Date().toISOString(),
        activeRooms: rooms.size,
        service: "FlareCall Cloudflare Signaling Worker"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Room info endpoint
    if (url.pathname.startsWith("/api/room/")) {
      const roomId = url.pathname.replace("/api/room/", "").trim();
      const room = rooms.get(roomId);
      const peerList = room ? Array.from(room.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        joinedAt: data.joinedAt,
        mediaState: data.mediaState
      })) : [];

      return new Response(JSON.stringify({
        roomId,
        exists: !!room,
        peerCount: peerList.length,
        peers: peerList
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // Signaling WebSocket upgrade endpoint (/ws or /signaling)
    if (url.pathname === "/ws" || url.pathname === "/signaling") {
      const upgradeHeader = request.headers.get("Upgrade");
      if (!upgradeHeader || upgradeHeader.toLowerCase() !== "websocket") {
        return new Response("Expected Upgrade: websocket", { status: 426, headers: corsHeaders });
      }

      const webSocketPair = new WebSocketPair();
      const [client, server] = Object.values(webSocketPair);

      server.accept();
      handleWebSocketSession(server);

      return new Response(null, {
        status: 101,
        webSocket: client,
        headers: corsHeaders
      });
    }

    // Root Welcome endpoint
    return new Response(JSON.stringify({
      name: "FlareCall Signaling Server",
      description: "Real-Time WebRTC Audio & Video Signaling Hub on Cloudflare Workers",
      version: "1.0.0",
      status: "running",
      endpoints: {
        websocket: "wss://<your-worker>/ws",
        health: "/api/health",
        roomInfo: "/api/room/:roomId"
      }
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
};

/**
 * Handle a connected WebSocket client session
 * @param {WebSocket} ws 
 */
function handleWebSocketSession(ws) {
  let currentRoomId = null;
  let currentPeerId = null;
  let peerName = "Anonymous";

  // Helper to send JSON securely
  const send = (data) => {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(typeof data === "string" ? data : JSON.stringify(data));
      }
    } catch (e) {
      console.error("[Signaling] Send error:", e);
    }
  };

  ws.addEventListener("message", (event) => {
    try {
      const rawData = typeof event.data === "string" ? event.data : new TextDecoder().decode(event.data);
      const msg = JSON.parse(rawData);

      switch (msg.type) {
        case "ping": {
          send({ type: "pong", timestamp: Date.now() });
          break;
        }

        case "join": {
          const { roomId, peerId, name, mediaState } = msg;
          if (!roomId || !peerId) {
            send({ type: "error", message: "roomId and peerId are required to join" });
            return;
          }

          currentRoomId = roomId;
          currentPeerId = peerId;
          peerName = name || "User " + peerId.substring(0, 4);

          if (!rooms.has(roomId)) {
            rooms.set(roomId, new Map());
          }
          const room = rooms.get(roomId);

          // Get existing peers in the room before adding the new one
          const existingPeers = [];
          for (const [id, data] of room.entries()) {
            if (id !== peerId) {
              existingPeers.push({
                peerId: id,
                name: data.name,
                joinedAt: data.joinedAt,
                mediaState: data.mediaState || { audio: true, video: true }
              });
            }
          }

          // Register new peer
          room.set(peerId, {
            ws,
            name: peerName,
            joinedAt: Date.now(),
            mediaState: mediaState || { audio: true, video: true }
          });

          // Confirm join to the current client
          send({
            type: "joined",
            roomId,
            peerId,
            name: peerName,
            peers: existingPeers,
            timestamp: Date.now()
          });

          // Broadcast "peer-joined" to all existing peers in the room
          for (const [id, data] of room.entries()) {
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
                console.error("[Signaling] Broadcast error:", err);
              }
            }
          }
          break;
        }

        case "offer":
        case "answer":
        case "ice-candidate": {
          const { roomId, targetPeerId, fromPeerId, sdp, candidate } = msg;
          if (!roomId || !targetPeerId) return;

          const room = rooms.get(roomId);
          if (room && room.has(targetPeerId)) {
            const targetPeer = room.get(targetPeerId);
            if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
              targetPeer.ws.send(JSON.stringify({
                ...msg,
                fromPeerId: fromPeerId || currentPeerId,
                fromName: peerName
              }));
            }
          }
          break;
        }

        case "call-request":
        case "call-response":
        case "call-hangup": {
          const { roomId, targetPeerId } = msg;
          if (!roomId) return;

          const room = rooms.get(roomId);
          if (room) {
            if (targetPeerId && room.has(targetPeerId)) {
              // Direct targeted call control
              const target = room.get(targetPeerId);
              if (target && target.ws.readyState === WebSocket.OPEN) {
                target.ws.send(JSON.stringify({
                  ...msg,
                  fromPeerId: currentPeerId,
                  fromName: peerName
                }));
              }
            } else {
              // Broadcast to room
              for (const [id, data] of room.entries()) {
                if (id !== currentPeerId && data.ws.readyState === WebSocket.OPEN) {
                  data.ws.send(JSON.stringify({
                    ...msg,
                    fromPeerId: currentPeerId,
                    fromName: peerName
                  }));
                }
              }
            }
          }
          break;
        }

        case "media-state": {
          const { roomId, mediaState } = msg;
          if (!roomId || !currentPeerId) return;

          const room = rooms.get(roomId);
          if (room) {
            const peer = room.get(currentPeerId);
            if (peer) peer.mediaState = mediaState;

            for (const [id, data] of room.entries()) {
              if (id !== currentPeerId && data.ws.readyState === WebSocket.OPEN) {
                data.ws.send(JSON.stringify({
                  type: "peer-media-state",
                  roomId,
                  peerId: currentPeerId,
                  mediaState
                }));
              }
            }
          }
          break;
        }

        case "chat": {
          const { roomId, text, timestamp } = msg;
          if (!roomId) return;

          const room = rooms.get(roomId);
          if (room) {
            const chatPayload = JSON.stringify({
              type: "chat",
              roomId,
              fromPeerId: currentPeerId,
              fromName: peerName,
              text,
              timestamp: timestamp || Date.now()
            });

            for (const [id, data] of room.entries()) {
              if (data.ws.readyState === WebSocket.OPEN) {
                data.ws.send(chatPayload);
              }
            }
          }
          break;
        }

        case "leave": {
          cleanup();
          break;
        }

        default:
          console.log("[Signaling] Unhandled message type:", msg.type);
      }
    } catch (err) {
      console.error("[Signaling] JSON parse/handling error:", err);
    }
  });

  const cleanup = () => {
    if (currentRoomId && currentPeerId) {
      const room = rooms.get(currentRoomId);
      if (room) {
        room.delete(currentPeerId);

        // Notify remaining peers in the room
        for (const [id, data] of room.entries()) {
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
              console.error("[Signaling] Leave notify error:", err);
            }
          }
        }

        if (room.size === 0) {
          rooms.delete(currentRoomId);
        }
      }
      currentRoomId = null;
      currentPeerId = null;
    }
  };

  ws.addEventListener("close", () => {
    cleanup();
  });

  ws.addEventListener("error", (e) => {
    console.error("[Signaling] WebSocket error:", e);
    cleanup();
  });
}
