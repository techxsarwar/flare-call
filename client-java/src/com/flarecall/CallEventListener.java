package com.flarecall;

import java.util.List;
import java.util.Map;

public interface CallEventListener {
    void onSignalingConnected();
    void onSignalingDisconnected(int statusCode, String reason);
    void onRoomJoined(String roomId, String myPeerId, String myName);
    void onPeerJoined(String peerId, String name);
    void onPeerLeft(String peerId, String name);
    void onIncomingCall(String fromPeerId, String fromName);
    void onCallAccepted(String fromPeerId, String fromName);
    void onCallDeclined(String fromPeerId, String reason);
    void onCallEnded(String peerId);
    void onRemoteSdpOffer(String fromPeerId, String sdp);
    void onRemoteSdpAnswer(String fromPeerId, String sdp);
    void onRemoteIceCandidate(String fromPeerId, String candidateJson);
    void onChatMessage(String fromPeerId, String fromName, String text, long timestamp);
    void onPeerMediaStateChanged(String peerId, boolean audio, boolean video, boolean screen);
    void onError(String message, Throwable cause);
    void onLog(String log);
}