import React, { useState, useRef, useEffect } from "react";
import { X, Send, Smile, MessageSquare, Sparkles } from "lucide-react";

export function ChatDrawer({ isOpen, onClose, messages, onSendMessage, currentPeerId }) {
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = (e) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    onSendMessage(text);
    setInputText("");
  };

  const sendQuickEmoji = (emoji) => {
    onSendMessage(emoji);
  };

  if (!isOpen) return null;

  return (
    <div className="chat-drawer">
      <div className="chat-header">
        <div className="chat-title-group">
          <MessageSquare size={18} className="text-indigo-400" />
          <h4>In-Call Chat</h4>
          <span className="badge-count">{messages.length}</span>
        </div>
        <button className="btn-icon-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      {/* Emoji Reactions Quick Bar */}
      <div className="quick-emojis-bar">
        {["??", "??", "??", "??", "??", "?", "??"].map(emoji => (
          <button
            key={emoji}
            className="btn-quick-emoji"
            onClick={() => sendQuickEmoji(emoji)}
            title={`React with ${emoji}`}
          >
            {emoji}
          </button>
        ))}
      </div>

      <div className="chat-messages-container">
        {messages.length === 0 ? (
          <div className="chat-empty-state">
            <Sparkles size={32} className="text-slate-600 mb-2" />
            <p>No messages yet. Send a quick hello or reaction!</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isMe = msg.fromPeerId === currentPeerId;
            const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit"
            });

            return (
              <div key={idx} className={`chat-bubble-row ${isMe ? "outgoing" : "incoming"}`}>
                {!isMe && <div className="chat-sender-name">{msg.fromName || "Peer"}</div>}
                <div className="chat-bubble">
                  <p>{msg.text}</p>
                  <span className="chat-time">{time}</span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSend}>
        <input
          type="text"
          placeholder="Type a message..."
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          className="chat-input-field"
        />
        <button type="submit" className="btn-chat-send" disabled={!inputText.trim()}>
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
