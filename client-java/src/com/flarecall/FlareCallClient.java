package com.flarecall;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.nio.ByteBuffer;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;

/**
 * FlareCall Java Client
 * 
 * Developed by: Sarwar Altaf Dar <https://github.com/techxsarwar>
 * License: GNU General Public License v3.0 (GPL-3.0-or-later)
 * 
 * Connects to the Cloudflare Worker signaling server and coordinates WebRTC calls.
 */
public class FlareCallClient implements WebSocket.Listener {
    private final String peerId;
    private String displayName;
    private String signalingUrl;
    private WebSocket webSocket;
    private CallSession session;
    private CallEventListener listener;
    private final StringBuilder messageBuffer = new StringBuilder();

    public FlareCallClient(String displayName) {
        this(UUID.randomUUID().toString().substring(0, 8), displayName);
    }

    public FlareCallClient(String peerId, String displayName) {
        this.peerId = peerId;
        this.displayName = displayName;
        this.session = new CallSession(peerId, displayName);
    }

    public void setListener(CallEventListener listener) {
        this.listener = listener;
    }

    public CallSession getSession() {
        return session;
    }

    public String getPeerId() {
        return peerId;
    }

    public String getDisplayName() {
        return displayName;
    }

    /**
     * Connect to Cloudflare Worker WebSocket Signaling endpoint (e.g. ws://localhost:8787/ws or wss://flare-call.workers.dev/ws)
     */
    public CompletableFuture<Void> connect(String signalingUrl) {
        this.signalingUrl = signalingUrl;
        log("Connecting to Cloudflare Signaling: " + signalingUrl);

        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();

        return client.newWebSocketBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .buildAsync(URI.create(signalingUrl), this)
                .thenAccept(ws -> {
                    this.webSocket = ws;
                    log("Connected to Signaling Server successfully!");
                    if (listener != null) listener.onSignalingConnected();
                })
                .exceptionally(ex -> {
                    log("Failed to connect to signaling: " + ex.getMessage());
                    if (listener != null) listener.onError("Connection failed", ex);
                    return null;
                });
    }

    /**
     * Join a call room
     */
    public void joinRoom(String roomId) {
        if (webSocket == null) {
            log("Cannot join room: WebSocket is not connected.");
            return;
        }

        SignalingMessage joinMsg = new SignalingMessage("join");
        joinMsg.roomId = roomId;
        joinMsg.peerId = peerId;
        joinMsg.name = displayName;
        
        Map<String, Object> media = new HashMap<>();
        media.put("audio", session.isAudioEnabled());
        media.put("video", session.isVideoEnabled());
        joinMsg.mediaState = media;

        session.setInLobby(roomId);
        sendMessage(joinMsg);
        log("Joined room request sent for room: " + roomId);
    }

    /**
     * Request a call to a target peer
     */
    public void callPeer(String targetPeerId, String targetName) {
        session.setOutgoingCall(targetPeerId, targetName);
        SignalingMessage msg = new SignalingMessage("call-request");
        msg.roomId = session.getRoomId();
        msg.targetPeerId = targetPeerId;
        msg.fromPeerId = peerId;
        msg.fromName = displayName;
        sendMessage(msg);
        log("Outgoing call initiated to " + targetName + " (" + targetPeerId + ")");
    }

    /**
     * Accept an incoming call
     */
    public void acceptCall(String targetPeerId) {
        SignalingMessage msg = new SignalingMessage("call-response");
        msg.roomId = session.getRoomId();
        msg.targetPeerId = targetPeerId;
        msg.fromPeerId = peerId;
        msg.fromName = displayName;
        msg.text = "accept";
        sendMessage(msg);
        session.setCallConnected();
        log("Accepted call from: " + targetPeerId);
    }

    /**
     * Decline an incoming call
     */
    public void declineCall(String targetPeerId, String reason) {
        SignalingMessage msg = new SignalingMessage("call-response");
        msg.roomId = session.getRoomId();
        msg.targetPeerId = targetPeerId;
        msg.fromPeerId = peerId;
        msg.fromName = displayName;
        msg.text = "decline:" + (reason != null ? reason : "user_declined");
        sendMessage(msg);
        session.setCallEnded();
        log("Declined call from: " + targetPeerId);
    }

    /**
     * End the current call
     */
    public void endCall() {
        if (session.getRemotePeerId() != null) {
            SignalingMessage msg = new SignalingMessage("call-hangup");
            msg.roomId = session.getRoomId();
            msg.targetPeerId = session.getRemotePeerId();
            msg.fromPeerId = peerId;
            sendMessage(msg);
        }
        session.setCallEnded();
        log("Call ended.");
        if (listener != null) listener.onCallEnded(peerId);
    }

    /**
     * Send WebRTC SDP Offer to peer
     */
    public void sendSdpOffer(String targetPeerId, String sdp) {
        SignalingMessage msg = new SignalingMessage("offer");
        msg.roomId = session.getRoomId();
        msg.targetPeerId = targetPeerId;
        msg.fromPeerId = peerId;
        msg.sdp = sdp;
        sendMessage(msg);
        log("Sent SDP Offer to " + targetPeerId);
    }

    /**
     * Send WebRTC SDP Answer to peer
     */
    public void sendSdpAnswer(String targetPeerId, String sdp) {
        SignalingMessage msg = new SignalingMessage("answer");
        msg.roomId = session.getRoomId();
        msg.targetPeerId = targetPeerId;
        msg.fromPeerId = peerId;
        msg.sdp = sdp;
        sendMessage(msg);
        log("Sent SDP Answer to " + targetPeerId);
    }

    /**
     * Send ICE candidate
     */
    public void sendIceCandidate(String targetPeerId, String candidateJson) {
        SignalingMessage msg = new SignalingMessage("ice-candidate");
        msg.roomId = session.getRoomId();
        msg.targetPeerId = targetPeerId;
        msg.fromPeerId = peerId;
        msg.text = candidateJson;
        sendMessage(msg);
    }

    /**
     * Send In-Call text chat
     */
    public void sendChatMessage(String text) {
        SignalingMessage msg = new SignalingMessage("chat");
        msg.roomId = session.getRoomId();
        msg.fromPeerId = peerId;
        msg.fromName = displayName;
        msg.text = text;
        sendMessage(msg);
    }

    /**
     * Update audio/video mute state
     */
    public void setMediaState(boolean audio, boolean video, boolean screen) {
        session.setAudioEnabled(audio);
        session.setVideoEnabled(video);
        session.setScreenShareEnabled(screen);

        SignalingMessage msg = new SignalingMessage("media-state");
        msg.roomId = session.getRoomId();
        Map<String, Object> state = new HashMap<>();
        state.put("audio", audio);
        state.put("video", video);
        state.put("screen", screen);
        msg.mediaState = state;
        sendMessage(msg);
    }

    public void disconnect() {
        if (webSocket != null) {
            webSocket.sendClose(WebSocket.NORMAL_CLOSURE, "Goodbye").join();
            webSocket = null;
        }
    }

    private void sendMessage(SignalingMessage msg) {
        if (webSocket != null) {
            String json = msg.toJson();
            webSocket.sendText(json, true);
        }
    }

    private void log(String message) {
        System.out.println("[FlareCall-Java] " + message);
        if (listener != null) listener.onLog(message);
    }

    // ================= WebSocket.Listener Implementation =================

    @Override
    public void onOpen(WebSocket webSocket) {
        webSocket.request(1);
    }

    @Override
    public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
        messageBuffer.append(data);
        if (last) {
            String completeMessage = messageBuffer.toString();
            messageBuffer.setLength(0);
            processIncomingMessage(completeMessage);
        }
        webSocket.request(1);
        return null;
    }

    @Override
    public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
        log("WebSocket closed: " + statusCode + " / " + reason);
        if (listener != null) listener.onSignalingDisconnected(statusCode, reason);
        return null;
    }

    @Override
    public void onError(WebSocket webSocket, Throwable error) {
        log("WebSocket error: " + error.getMessage());
        if (listener != null) listener.onError("WebSocket error", error);
    }

    private void processIncomingMessage(String rawJson) {
        try {
            SignalingMessage msg = SignalingMessage.fromJson(rawJson);
            if (msg.type == null) return;

            switch (msg.type) {
                case "joined":
                    log("Room joined: " + msg.roomId);
                    if (listener != null) listener.onRoomJoined(msg.roomId, peerId, displayName);
                    break;

                case "peer-joined":
                    log("New peer entered room: " + msg.name + " (" + msg.peerId + ")");
                    if (listener != null) listener.onPeerJoined(msg.peerId, msg.name);
                    break;

                case "peer-left":
                    log("Peer left room: " + msg.name + " (" + msg.peerId + ")");
                    if (listener != null) listener.onPeerLeft(msg.peerId, msg.name);
                    break;

                case "call-request":
                    log("Incoming call from: " + msg.fromName + " (" + msg.fromPeerId + ")");
                    session.setIncomingCall(msg.fromPeerId, msg.fromName);
                    if (listener != null) listener.onIncomingCall(msg.fromPeerId, msg.fromName);
                    break;

                case "call-response":
                    if (msg.text != null && msg.text.startsWith("accept")) {
                        log("Call accepted by " + msg.fromName);
                        session.setCallConnected();
                        if (listener != null) listener.onCallAccepted(msg.fromPeerId, msg.fromName);
                    } else {
                        log("Call declined by " + msg.fromName);
                        session.setCallEnded();
                        if (listener != null) listener.onCallDeclined(msg.fromPeerId, msg.text);
                    }
                    break;

                case "call-hangup":
                    log("Remote peer hung up: " + msg.fromPeerId);
                    session.setCallEnded();
                    if (listener != null) listener.onCallEnded(msg.fromPeerId);
                    break;

                case "offer":
                    log("Received SDP Offer from: " + msg.fromPeerId);
                    if (listener != null) listener.onRemoteSdpOffer(msg.fromPeerId, msg.sdp);
                    break;

                case "answer":
                    log("Received SDP Answer from: " + msg.fromPeerId);
                    if (listener != null) listener.onRemoteSdpAnswer(msg.fromPeerId, msg.sdp);
                    break;

                case "ice-candidate":
                    if (listener != null) listener.onRemoteIceCandidate(msg.fromPeerId, msg.text);
                    break;

                case "chat":
                    log("Chat [" + msg.fromName + "]: " + msg.text);
                    if (listener != null) listener.onChatMessage(msg.fromPeerId, msg.fromName, msg.text, msg.timestamp);
                    break;

                case "peer-media-state":
                    if (listener != null && msg.mediaState != null) {
                        boolean a = Boolean.TRUE.equals(msg.mediaState.get("audio"));
                        boolean v = Boolean.TRUE.equals(msg.mediaState.get("video"));
                        boolean s = Boolean.TRUE.equals(msg.mediaState.get("screen"));
                        listener.onPeerMediaStateChanged(msg.peerId, a, v, s);
                    }
                    break;
            }
        } catch (Exception e) {
            log("Error processing message: " + e.getMessage());
        }
    }
}
