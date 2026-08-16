import React, { useState, useEffect, useRef, useMemo } from "react";
import { Lobby } from "./components/Lobby";
import { CallView } from "./components/CallView";
import { ChatDrawer } from "./components/ChatDrawer";
import { SettingsModal } from "./components/SettingsModal";
import { WebRTCService } from "./services/webrtc";
import { SoundEngine } from "./services/sounds";

// Cloudflare Signaling WebSocket URL
const CLOUDFLARE_WORKER_WS = "wss://flare-call-signaling.aarifgmr.workers.dev/ws";

const getSignalingUrl = () => {
  // If running on local server port 8787 or explicitly requested, use localhost, otherwise connect to live Cloudflare edge
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("local") === "true") {
    return "ws://localhost:8787/ws";
  }
  return CLOUDFLARE_WORKER_WS;
};

export default function App() {
  // Session & User State
  const [displayName, setDisplayName] = useState(() => {
    return localStorage.getItem("flarecall_name") || "Caller " + Math.floor(100 + Math.random() * 900);
  });
  const myPeerId = useMemo(() => {
    let id = sessionStorage.getItem("flarecall_peer_id");
    if (!id) {
      id = "peer_" + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem("flarecall_peer_id", id);
    }
    return id;
  }, []);

  // Room & Navigation State
  const [roomId, setRoomId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("room") || "";
  });
  const [inCall, setInCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Peers & Media State
  const [peers, setPeers] = useState(new Map());
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [localStream, setLocalStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  // Chat & UI State
  const [chatMessages, setChatMessages] = useState([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [mediaSettings, setMediaSettings] = useState({
    audioDeviceId: "",
    videoDeviceId: "",
    audioOutputDeviceId: "",
    resolution: "720p (HD)",
    noiseSuppression: true
  });
  const [diagnosticsStats, setDiagnosticsStats] = useState(null);

  // Incoming Call State
  const [incomingCall, setIncomingCall] = useState(null);

  // Refs
  const rtcServiceRef = useRef(null);
  const wsRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Initialize WebRTC and Local Camera on Mount
  useEffect(() => {
    const rtc = new WebRTCService({
      onRemoteStream: (peerId, stream) => {
        setRemoteStreams(prev => new Map(prev.set(peerId, stream)));
        SoundEngine.playConnected();
      },
      onRemoteStreamRemoved: (peerId) => {
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.delete(peerId);
          return next;
        });
      },
      onIceCandidate: (peerId, candidate) => {
        sendSignalingMessage({
          type: "ice-candidate",
          roomId,
          targetPeerId: peerId,
          fromPeerId: myPeerId,
          candidate
        });
      },
      onConnectionStateChange: (peerId, state) => {
        console.log(`[WebRTC] Peer ${peerId} state changed: ${state}`);
      },
      onStats: (stats) => {
        setDiagnosticsStats(stats);
      }
    });

    rtcServiceRef.current = rtc;

    // Start local preview
    rtc.getLocalMedia({ audio: true, video: true })
      .then(stream => {
        setLocalStream(stream);
      })
      .catch(err => {
        console.warn("Could not get local media for preview:", err);
      });

    return () => {
      rtc.close();
      if (wsRef.current) wsRef.current.close();
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, []);

  // Save display name changes
  const handleNameChange = (name) => {
    setDisplayName(name);
    localStorage.setItem("flarecall_name", name);
  };

  // Connect & Join Room
  const joinRoom = (targetRoomId) => {
    if (!targetRoomId) return;
    setRoomId(targetRoomId);

    // Update browser URL query without reload
    const newUrl = `${window.location.pathname}?room=${encodeURIComponent(targetRoomId)}`;
    window.history.pushState({ path: newUrl }, "", newUrl);

    // Connect Signaling WebSocket
    const wsUrl = getSignalingUrl();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[Signaling] Connected to Cloudflare Worker:", wsUrl);
      ws.send(JSON.stringify({
        type: "join",
        roomId: targetRoomId,
        peerId: myPeerId,
        name: displayName,
        mediaState: {
          audio: !isAudioMuted,
          video: !isVideoMuted
        }
      }));
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleSignalingMessage(msg, targetRoomId);
      } catch (e) {
        console.error("[Signaling] Error parsing message:", e);
      }
    };

    ws.onclose = () => {
      console.log("[Signaling] Disconnected from edge");
    };

    ws.onerror = (err) => {
      console.error("[Signaling] WebSocket error:", err);
    };

    setInCall(true);
    setCallDuration(0);
    timerIntervalRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  // Route incoming WebSocket messages
  const handleSignalingMessage = async (msg, currentRoom) => {
    const rtc = rtcServiceRef.current;
    if (!rtc) return;

    switch (msg.type) {
      case "joined": {
        const peerMap = new Map();
        peerMap.set(myPeerId, { peerId: myPeerId, name: displayName });
        if (msg.peers) {
          msg.peers.forEach(p => {
            peerMap.set(p.peerId, p);
          });
        }
        setPeers(peerMap);

        // If existing peers are in the room, send SDP offers to connect
        if (msg.peers && msg.peers.length > 0) {
          for (const peer of msg.peers) {
            const offer = await rtc.createOffer(peer.peerId);
            sendSignalingMessage({
              type: "offer",
              roomId: currentRoom,
              targetPeerId: peer.peerId,
              fromPeerId: myPeerId,
              sdp: offer.sdp
            });
          }
        }
        break;
      }

      case "peer-joined": {
        setPeers(prev => {
          const next = new Map(prev);
          next.set(msg.peerId, { peerId: msg.peerId, name: msg.name });
          return next;
        });
        break;
      }

      case "peer-left": {
        setPeers(prev => {
          const next = new Map(prev);
          next.delete(msg.peerId);
          return next;
        });
        setRemoteStreams(prev => {
          const next = new Map(prev);
          next.delete(msg.peerId);
          return next;
        });
        break;
      }

      case "offer": {
        const answer = await rtc.handleOfferAndCreateAnswer(msg.fromPeerId, msg.sdp);
        sendSignalingMessage({
          type: "answer",
          roomId: currentRoom,
          targetPeerId: msg.fromPeerId,
          fromPeerId: myPeerId,
          sdp: answer.sdp
        });
        break;
      }

      case "answer": {
        await rtc.handleAnswer(msg.fromPeerId, msg.sdp);
        break;
      }

      case "ice-candidate": {
        if (msg.candidate) {
          await rtc.addIceCandidate(msg.fromPeerId, msg.candidate);
        }
        break;
      }

      case "chat": {
        setChatMessages(prev => [...prev, msg]);
        if (!isChatOpen) {
          setUnreadChatCount(prev => prev + 1);
        }
        SoundEngine.playMessagePop();
        break;
      }

      case "call-request": {
        setIncomingCall({
          fromPeerId: msg.fromPeerId,
          fromName: msg.fromName || "Unknown Caller"
        });
        SoundEngine.startIncomingRingtone();
        break;
      }

      case "call-hangup": {
        SoundEngine.playHangup();
        break;
      }
    }
  };

  const sendSignalingMessage = (msg) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  };

  // Media Controls
  const toggleAudio = () => {
    if (rtcServiceRef.current) {
      const nowAudio = !isAudioMuted;
      rtcServiceRef.current.toggleAudio(!nowAudio);
      setIsAudioMuted(nowAudio);
      sendSignalingMessage({
        type: "media-state",
        roomId,
        mediaState: { audio: !nowAudio, video: !isVideoMuted }
      });
    }
  };

  const toggleVideo = () => {
    if (rtcServiceRef.current) {
      const nowVideo = !isVideoMuted;
      rtcServiceRef.current.toggleVideo(!nowVideo);
      setIsVideoMuted(nowVideo);
      sendSignalingMessage({
        type: "media-state",
        roomId,
        mediaState: { audio: !isAudioMuted, video: !nowVideo }
      });
    }
  };

  const toggleScreenShare = async () => {
    if (!rtcServiceRef.current) return;
    try {
      if (isScreenSharing) {
        await rtcServiceRef.current.stopScreenShare();
        setIsScreenSharing(false);
      } else {
        await rtcServiceRef.current.startScreenShare();
        setIsScreenSharing(true);
      }
    } catch (err) {
      console.warn("Screen share toggling error:", err);
      setIsScreenSharing(false);
    }
  };

  const endCall = () => {
    SoundEngine.playHangup();
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify({ type: "leave", roomId, peerId: myPeerId }));
      wsRef.current.close();
      wsRef.current = null;
    }
    if (rtcServiceRef.current) {
      rtcServiceRef.current.close();
      // Re-init preview
      rtcServiceRef.current.getLocalMedia({ audio: true, video: true })
        .then(stream => setLocalStream(stream))
        .catch(() => {});
    }

    setInCall(false);
    setPeers(new Map());
    setRemoteStreams(new Map());
    setChatMessages([]);
    setUnreadChatCount(0);
    setIsChatOpen(false);
    setIsScreenSharing(false);

    // Clean URL
    window.history.pushState({}, "", window.location.pathname);
  };

  const sendChatMessage = (text) => {
    sendSignalingMessage({
      type: "chat",
      roomId,
      fromPeerId: myPeerId,
      fromName: displayName,
      text,
      timestamp: Date.now()
    });
  };

  const handleApplySettings = async (newSettings) => {
    setMediaSettings(newSettings);
    if (rtcServiceRef.current) {
      try {
        const stream = await rtcServiceRef.current.getLocalMedia({
          audio: !isAudioMuted,
          video: !isVideoMuted,
          audioDeviceId: newSettings.audioDeviceId,
          videoDeviceId: newSettings.videoDeviceId
        });
        setLocalStream(stream);
      } catch (err) {
        console.warn("Could not apply media settings:", err);
      }
    }
  };

  return (
    <div className="app-root">
      {!inCall ? (
        <Lobby
          displayName={displayName}
          onNameChange={handleNameChange}
          roomId={roomId}
          onRoomIdChange={setRoomId}
          onJoinRoom={joinRoom}
          onCreateRoom={joinRoom}
          localStream={localStream}
          isAudioMuted={isAudioMuted}
          isVideoMuted={isVideoMuted}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
          onOpenSettings={() => setIsSettingsOpen(true)}
          audioAnalyser={rtcServiceRef.current?.localAnalyser}
        />
      ) : (
        <div className="call-layout-wrapper">
          <CallView
            roomId={roomId}
            myPeerId={myPeerId}
            displayName={displayName}
            peers={peers}
            remoteStreams={remoteStreams}
            localStream={localStream}
            isAudioMuted={isAudioMuted}
            isVideoMuted={isVideoMuted}
            isScreenSharing={isScreenSharing}
            onToggleAudio={toggleAudio}
            onToggleVideo={toggleVideo}
            onToggleScreenShare={toggleScreenShare}
            onEndCall={endCall}
            onOpenChat={() => {
              setIsChatOpen(!isChatOpen);
              setUnreadChatCount(0);
            }}
            onOpenSettings={() => setIsSettingsOpen(true)}
            unreadCount={unreadChatCount}
            callDuration={callDuration}
            stats={diagnosticsStats}
            audioAnalyser={rtcServiceRef.current?.localAnalyser}
            remoteAnalyser={rtcServiceRef.current?.remoteAnalyser}
          />

          <ChatDrawer
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
            messages={chatMessages}
            onSendMessage={sendChatMessage}
            currentPeerId={myPeerId}
          />
        </div>
      )}

      {/* Device Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentSettings={mediaSettings}
        onSaveSettings={handleApplySettings}
      />
    </div>
  );
}
