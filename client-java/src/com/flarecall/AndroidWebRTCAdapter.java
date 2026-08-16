package com.flarecall;

/**
 * Android WebRTC Bridge Adapter
 * 
 * Developed by: Sarwar Altaf Dar <https://github.com/techxsarwar>
 * License: GNU General Public License v3.0 (GPL-3.0-or-later)
 * 
 * Provides an enterprise-grade reference integration pattern for Android applications
 * (such as FitRace / React Native Android native module) connecting to the FlareCall Cloudflare Worker.
 * 
 * In a standard Android project, you would include:
 *   implementation "org.webrtc:google-webrtc:1.0.32007"
 */
public class AndroidWebRTCAdapter {

    private final FlareCallClient client;
    private final String peerId;

    public AndroidWebRTCAdapter(String displayName) {
        this.client = new FlareCallClient(displayName);
        this.peerId = client.getPeerId();
        setupSignalingBridge();
    }

    private void setupSignalingBridge() {
        client.setListener(new CallEventListener() {
            @Override
            public void onSignalingConnected() {
                System.out.println("[AndroidWebRTC] Connected to Cloudflare Signaling Edge");
            }

            @Override
            public void onSignalingDisconnected(int statusCode, String reason) {
                System.out.println("[AndroidWebRTC] Disconnected: " + reason);
            }

            @Override
            public void onRoomJoined(String roomId, String myPeerId, String myName) {
                System.out.println("[AndroidWebRTC] In Room: " + roomId);
            }

            @Override
            public void onPeerJoined(String peerId, String name) {
                System.out.println("[AndroidWebRTC] Remote user joined: " + name);
            }

            @Override
            public void onPeerLeft(String peerId, String name) {
                System.out.println("[AndroidWebRTC] Remote user left: " + name);
            }

            @Override
            public void onIncomingCall(String fromPeerId, String fromName) {
                System.out.println("[AndroidWebRTC] INCOMING CALL from: " + fromName + " (" + fromPeerId + ")");
                // On Android: Trigger native Fullscreen Calling Notification / Ringtone
            }

            @Override
            public void onCallAccepted(String fromPeerId, String fromName) {
                System.out.println("[AndroidWebRTC] Call accepted! Initializing local media tracks...");
                // On Android: Create PeerConnection and initiate SDP Offer
            }

            @Override
            public void onCallDeclined(String fromPeerId, String reason) {
                System.out.println("[AndroidWebRTC] Call declined: " + reason);
            }

            @Override
            public void onCallEnded(String peerId) {
                System.out.println("[AndroidWebRTC] Call ended. Closing local audio/video capture...");
            }

            @Override
            public void onRemoteSdpOffer(String fromPeerId, String sdp) {
                System.out.println("[AndroidWebRTC] Received SDP Offer from " + fromPeerId);
                // On Android: peerConnection.setRemoteDescription(new SessionDescription(Type.OFFER, sdp))
            }

            @Override
            public void onRemoteSdpAnswer(String fromPeerId, String sdp) {
                System.out.println("[AndroidWebRTC] Received SDP Answer from " + fromPeerId);
                // On Android: peerConnection.setRemoteDescription(new SessionDescription(Type.ANSWER, sdp))
            }

            @Override
            public void onRemoteIceCandidate(String fromPeerId, String candidateJson) {
                System.out.println("[AndroidWebRTC] Adding remote ICE candidate: " + candidateJson);
                // On Android: peerConnection.addIceCandidate(...)
            }

            @Override
            public void onChatMessage(String fromPeerId, String fromName, String text, long timestamp) {
                System.out.println("[AndroidWebRTC] In-Call Chat from " + fromName + ": " + text);
            }

            @Override
            public void onPeerMediaStateChanged(String peerId, boolean audio, boolean video, boolean screen) {
                System.out.println("[AndroidWebRTC] Peer " + peerId + " media state: Mic=" + audio + ", Cam=" + video);
            }

            @Override
            public void onError(String message, Throwable cause) {
                System.err.println("[AndroidWebRTC] Error: " + message);
                if (cause != null) cause.printStackTrace();
            }

            @Override
            public void onLog(String log) {
                // Log to Android Logcat
            }
        });
    }

    public FlareCallClient getClient() {
        return client;
    }
}
