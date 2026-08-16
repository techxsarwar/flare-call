package com.flarecall;

import java.util.*;

/**
 * Lightweight JSON parser and builder for FlareCall signaling messages.
 * Designed to compile and run with standard Java 11+ with zero external JAR dependencies.
 * 
 * Developed by: Sarwar Altaf Dar <https://github.com/techxsarwar>
 * License: GNU General Public License v3.0 (GPL-3.0-or-later)
 */
public class SignalingMessage {
    public String type;
    public String roomId;
    public String peerId;
    public String fromPeerId;
    public String targetPeerId;
    public String name;
    public String fromName;
    public String text;
    public String sdp;
    public Map<String, Object> candidate;
    public Map<String, Object> mediaState;
    public List<Map<String, Object>> peers;
    public long timestamp;

    public SignalingMessage() {
        this.timestamp = System.currentTimeMillis();
    }

    public SignalingMessage(String type) {
        this.type = type;
        this.timestamp = System.currentTimeMillis();
    }

    /**
     * Convert this message to a JSON string
     */
    public String toJson() {
        StringBuilder sb = new StringBuilder("{");
        boolean first = true;

        first = appendField(sb, "type", type, first);
        first = appendField(sb, "roomId", roomId, first);
        first = appendField(sb, "peerId", peerId, first);
        first = appendField(sb, "fromPeerId", fromPeerId, first);
        first = appendField(sb, "targetPeerId", targetPeerId, first);
        first = appendField(sb, "name", name, first);
        first = appendField(sb, "fromName", fromName, first);
        first = appendField(sb, "text", text, first);
        first = appendField(sb, "sdp", sdp, first);
        
        if (candidate != null) {
            if (!first) sb.append(",");
            sb.append("\"candidate\":{");
            boolean cFirst = true;
            for (Map.Entry<String, Object> entry : candidate.entrySet()) {
                cFirst = appendField(sb, entry.getKey(), entry.getValue(), cFirst);
            }
            sb.append("}");
            first = false;
        }

        if (mediaState != null) {
            if (!first) sb.append(",");
            sb.append("\"mediaState\":{");
            boolean mFirst = true;
            for (Map.Entry<String, Object> entry : mediaState.entrySet()) {
                mFirst = appendField(sb, entry.getKey(), entry.getValue(), mFirst);
            }
            sb.append("}");
            first = false;
        }

        if (!first) sb.append(",");
        sb.append("\"timestamp\":").append(timestamp);
        sb.append("}");
        return sb.toString();
    }

    private static boolean appendField(StringBuilder sb, String key, Object val, boolean first) {
        if (val == null) return first;
        if (!first) sb.append(",");
        sb.append("\"").append(escape(key)).append("\":");
        if (val instanceof Number || val instanceof Boolean) {
            sb.append(val);
        } else {
            sb.append("\"").append(escape(val.toString())).append("\"");
        }
        return false;
    }

    private static String escape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\b", "\\b")
                .replace("\f", "\\f")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t");
    }

    /**
     * Basic JSON parser for WebRTC signaling messages
     */
    public static SignalingMessage fromJson(String json) {
        SignalingMessage msg = new SignalingMessage();
        if (json == null || json.trim().isEmpty()) return msg;
        
        json = json.trim();
        if (json.startsWith("{") && json.endsWith("}")) {
            json = json.substring(1, json.length() - 1);
        }

        List<String> tokens = splitJsonFields(json);
        for (String token : tokens) {
            int colonIdx = token.indexOf(':');
            if (colonIdx == -1) continue;
            String rawKey = token.substring(0, colonIdx).trim();
            String rawVal = token.substring(colonIdx + 1).trim();

            String key = unquote(rawKey);
            
            if ("type".equals(key)) msg.type = unquote(rawVal);
            else if ("roomId".equals(key)) msg.roomId = unquote(rawVal);
            else if ("peerId".equals(key)) msg.peerId = unquote(rawVal);
            else if ("fromPeerId".equals(key)) msg.fromPeerId = unquote(rawVal);
            else if ("targetPeerId".equals(key)) msg.targetPeerId = unquote(rawVal);
            else if ("name".equals(key)) msg.name = unquote(rawVal);
            else if ("fromName".equals(key)) msg.fromName = unquote(rawVal);
            else if ("text".equals(key)) msg.text = unquote(rawVal);
            else if ("sdp".equals(key)) msg.sdp = unquote(rawVal);
            else if ("timestamp".equals(key)) {
                try { msg.timestamp = Long.parseLong(rawVal); } catch (Exception ignored) {}
            }
        }
        return msg;
    }

    private static String unquote(String s) {
        s = s.trim();
        if (s.startsWith("\"") && s.endsWith("\"") && s.length() >= 2) {
            s = s.substring(1, s.length() - 1);
        }
        return s.replace("\\\"", "\"").replace("\\n", "\n").replace("\\r", "\r").replace("\\\\", "\\");
    }

    private static List<String> splitJsonFields(String json) {
        List<String> list = new ArrayList<>();
        int braceDepth = 0;
        int bracketDepth = 0;
        boolean inQuote = false;
        StringBuilder curr = new StringBuilder();

        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '\\' && inQuote && i + 1 < json.length()) {
                curr.append(c).append(json.charAt(i + 1));
                i++;
                continue;
            }
            if (c == '"') inQuote = !inQuote;
            if (!inQuote) {
                if (c == '{') braceDepth++;
                else if (c == '}') braceDepth--;
                else if (c == '[') bracketDepth++;
                else if (c == ']') bracketDepth--;
                else if (c == ',' && braceDepth == 0 && bracketDepth == 0) {
                    list.add(curr.toString());
                    curr = new StringBuilder();
                    continue;
                }
            }
            curr.append(c);
        }
        if (curr.length() > 0) list.add(curr.toString());
        return list;
    }

    @Override
    public String toString() {
        return "SignalingMessage[type=" + type + ", room=" + roomId + ", from=" + fromName + "(" + fromPeerId + ")]";
    }
}
