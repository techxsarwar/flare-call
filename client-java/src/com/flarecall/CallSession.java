package com.flarecall;

public class CallSession {
    private String roomId;
    private String myPeerId;
    private String myDisplayName;
    private String remotePeerId;
    private String remoteDisplayName;
    private CallState state = CallState.IDLE;
    private long callStartTime = 0;
    private boolean audioEnabled = true;
    private boolean videoEnabled = true;
    private boolean screenShareEnabled = false;

    public CallSession(String myPeerId, String myDisplayName) {
        this.myPeerId = myPeerId;
        this.myDisplayName = myDisplayName;
    }

    public synchronized void setInLobby(String roomId) {
        this.roomId = roomId;
        this.state = CallState.CONNECTED_LOBBY;
    }

    public synchronized void setOutgoingCall(String targetPeerId, String targetName) {
        this.remotePeerId = targetPeerId;
        this.remoteDisplayName = targetName;
        this.state = CallState.OUTGOING_CALL;
    }

    public synchronized void setIncomingCall(String fromPeerId, String fromName) {
        this.remotePeerId = fromPeerId;
        this.remoteDisplayName = fromName;
        this.state = CallState.INCOMING_CALL;
    }

    public synchronized void setCallConnected() {
        this.state = CallState.IN_CALL;
        this.callStartTime = System.currentTimeMillis();
    }

    public synchronized void setCallEnded() {
        this.state = CallState.ENDED;
        this.remotePeerId = null;
        this.remoteDisplayName = null;
    }

    public synchronized long getCallDurationSeconds() {
        if (state != CallState.IN_CALL || callStartTime == 0) return 0;
        return (System.currentTimeMillis() - callStartTime) / 1000;
    }

    // Getters & Setters
    public String getRoomId() { return roomId; }
    public String getMyPeerId() { return myPeerId; }
    public String getMyDisplayName() { return myDisplayName; }
    public void setMyDisplayName(String name) { this.myDisplayName = name; }
    public String getRemotePeerId() { return remotePeerId; }
    public String getRemoteDisplayName() { return remoteDisplayName; }
    public CallState getState() { return state; }
    public void setState(CallState state) { this.state = state; }
    public boolean isAudioEnabled() { return audioEnabled; }
    public void setAudioEnabled(boolean audioEnabled) { this.audioEnabled = audioEnabled; }
    public boolean isVideoEnabled() { return videoEnabled; }
    public void setVideoEnabled(boolean videoEnabled) { this.videoEnabled = videoEnabled; }
    public boolean isScreenShareEnabled() { return screenShareEnabled; }
    public void setScreenShareEnabled(boolean screenShareEnabled) { this.screenShareEnabled = screenShareEnabled; }
}
