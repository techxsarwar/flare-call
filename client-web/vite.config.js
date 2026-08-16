import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { WebSocketServer } from "ws";

/**
 * Integrated WebSocket Signaling Plugin for FlareCall
 * Handles ultra-low latency signaling directly on Vite's HTTPS server
 */
function flareCallSignalingPlugin() {
  const rooms = new Map(); // roomId -> Map<peerId, { ws, name, joinedAt, mediaState }>

  return {
    name: "flare-call-signaling",
    configureServer(server) {
      const wss = new WebSocketServer({ noServer: true });

      server.httpServer.on("upgrade", (req, socket, head) => {
        const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
        if (url.pathname === "/ws" || url.pathname === "/signaling") {
          wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit("connection", ws, req);
          });
        }
      });

      wss.on("connection", (ws) => {
        let currentRoomId = null;
        let currentPeerId = null;
        let peerName = "Anonymous";

        const send = (data) => {
          if (ws.readyState === ws.OPEN) {
            ws.send(typeof data === "string" ? data : JSON.stringify(data));
          }
        };

        ws.on("message", (raw) => {
          try {
            const msg = JSON.parse(raw.toString());
            switch (msg.type) {
              case "ping":
                send({ type: "pong", timestamp: Date.now() });
                break;

              case "join": {
                const { roomId, peerId, name, mediaState } = msg;
                if (!roomId || !peerId) return;

                currentRoomId = roomId;
                currentPeerId = peerId;
                peerName = name || "User " + peerId.substring(0, 4);

                if (!rooms.has(roomId)) {
                  rooms.set(roomId, new Map());
                }
                const room = rooms.get(roomId);

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

                room.set(peerId, {
                  ws,
                  name: peerName,
                  joinedAt: Date.now(),
                  mediaState: mediaState || { audio: true, video: true }
                });

                console.log(`[Signaling] Peer ${peerId} (${peerName}) joined room ${roomId}. Room size: ${room.size}`);

                send({
                  type: "joined",
                  roomId,
                  peerId,
                  name: peerName,
                  peers: existingPeers,
                  timestamp: Date.now()
                });

                for (const [id, data] of room.entries()) {
                  if (id !== peerId && data.ws.readyState === ws.OPEN) {
                    data.ws.send(JSON.stringify({
                      type: "peer-joined",
                      roomId,
                      peerId,
                      name: peerName,
                      mediaState: mediaState || { audio: true, video: true },
                      timestamp: Date.now()
                    }));
                  }
                }
                break;
              }

              case "offer":
              case "answer":
              case "ice-candidate": {
                const { roomId, targetPeerId, fromPeerId } = msg;
                if (!roomId || !targetPeerId) return;
                const room = rooms.get(roomId);
                if (room && room.has(targetPeerId)) {
                  const target = room.get(targetPeerId);
                  if (target && target.ws.readyState === ws.OPEN) {
                    target.ws.send(JSON.stringify({
                      ...msg,
                      fromPeerId: fromPeerId || currentPeerId,
                      fromName: peerName
                    }));
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
                    if (id !== currentPeerId && data.ws.readyState === ws.OPEN) {
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
                    if (data.ws.readyState === ws.OPEN) {
                      data.ws.send(chatPayload);
                    }
                  }
                }
                break;
              }

              case "leave":
                cleanup();
                break;
            }
          } catch (e) {
            console.error("[Signaling] Parse error:", e);
          }
        });

        const cleanup = () => {
          if (currentRoomId && currentPeerId) {
            const room = rooms.get(currentRoomId);
            if (room) {
              room.delete(currentPeerId);
              console.log(`[Signaling] Peer ${currentPeerId} left room ${currentRoomId}. Remaining: ${room.size}`);
              for (const [id, data] of room.entries()) {
                if (data.ws.readyState === ws.OPEN) {
                  data.ws.send(JSON.stringify({
                    type: "peer-left",
                    roomId: currentRoomId,
                    peerId: currentPeerId,
                    name: peerName,
                    timestamp: Date.now()
                  }));
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

        ws.on("close", cleanup);
        ws.on("error", cleanup);
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), basicSsl(), flareCallSignalingPlugin()],
  server: {
    port: 5173,
    host: true
  }
});
