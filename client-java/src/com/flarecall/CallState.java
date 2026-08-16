package com.flarecall;

public enum CallState {
    IDLE,
    CONNECTING_SIGNALING,
    CONNECTED_LOBBY,
    INCOMING_CALL,
    OUTGOING_CALL,
    ESTABLISHING_STREAM,
    IN_CALL,
    ENDED
}
