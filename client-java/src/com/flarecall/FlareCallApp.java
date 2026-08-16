package com.flarecall;

import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.Scanner;

/**
 * FlareCall Java Desktop Client (Swing GUI & Interactive CLI)
 * 
 * Developed by: Sarwar Altaf Dar <https://github.com/techxsarwar>
 * License: GNU General Public License v3.0 (GPL-3.0-or-later)
 */
public class FlareCallApp implements CallEventListener {

    private final FlareCallClient client;
    private JFrame frame;
    private JTextField urlField;
    private JTextField roomField;
    private JTextField nameField;
    private JTextField chatInputField;
    private JTextArea logArea;
    private JTextArea chatArea;
    private DefaultListModel<String> peerListModel;
    private JLabel statusLabel;
    private JButton connectBtn;
    private JButton joinBtn;
    private JButton callBtn;
    private JButton endCallBtn;
    private JButton sendChatBtn;

    public FlareCallApp(String defaultName) {
        this.client = new FlareCallClient(defaultName);
        this.client.setListener(this);
    }

    public static void main(String[] args) {
        boolean cliMode = false;
        String name = "JavaUser-" + (int)(Math.random() * 900 + 100);

        for (String arg : args) {
            if ("--cli".equalsIgnoreCase(arg)) cliMode = true;
            if (arg.startsWith("--name=")) name = arg.substring(7);
        }

        FlareCallApp app = new FlareCallApp(name);

        if (cliMode || GraphicsEnvironment.isHeadless()) {
            app.startCli();
        } else {
            SwingUtilities.invokeLater(app::buildAndShowGui);
        }
    }

    private void buildAndShowGui() {
        try {
            UIManager.setLookAndFeel(UIManager.getCrossPlatformLookAndFeelClassName());
        } catch (Exception ignored) {}

        frame = new JFrame("FlareCall - Real-Time WebRTC Calling (By Sarwar Altaf Dar)");
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setSize(950, 680);
        frame.setLocationRelativeTo(null);

        // Dark modern color palette
        Color bgDark = new Color(15, 23, 42); // slate-900
        Color bgCard = new Color(30, 41, 59); // slate-800
        Color accentIndigo = new Color(99, 102, 241); // indigo-500
        Color accentGreen = new Color(34, 197, 94); // emerald-500
        Color accentRed = new Color(239, 68, 68); // rose-500
        Color textWhite = new Color(248, 250, 252);
        Color textMuted = new Color(148, 163, 184);

        frame.getContentPane().setBackground(bgDark);
        frame.setLayout(new BorderLayout(12, 12));

        // Top Header Panel: Connection & Room details
        JPanel topPanel = new JPanel(new GridLayout(2, 1, 6, 6));
        topPanel.setBackground(bgCard);
        topPanel.setBorder(new EmptyBorder(12, 16, 12, 16));

        JPanel row1 = new JPanel(new FlowLayout(FlowLayout.LEFT, 10, 2));
        row1.setOpaque(false);
        row1.add(createLabel("Signaling URL:", textWhite));
        urlField = new JTextField("wss://flare-call-signaling.aarifgmr.workers.dev/ws", 28);
        styleTextField(urlField);
        row1.add(urlField);

        connectBtn = createButton("Connect", accentIndigo, Color.WHITE);
        row1.add(connectBtn);

        statusLabel = createLabel("Disconnected", new Color(248, 113, 113));
        row1.add(statusLabel);

        JPanel row2 = new JPanel(new FlowLayout(FlowLayout.LEFT, 10, 2));
        row2.setOpaque(false);
        row2.add(createLabel("Your Name:", textWhite));
        nameField = new JTextField(client.getDisplayName(), 12);
        styleTextField(nameField);
        row2.add(nameField);

        row2.add(createLabel("Room ID / Code:", textWhite));
        roomField = new JTextField("demo-room", 12);
        styleTextField(roomField);
        row2.add(roomField);

        joinBtn = createButton("Join Room", accentGreen, Color.WHITE);
        joinBtn.setEnabled(false);
        row2.add(joinBtn);

        callBtn = createButton("Call Selected Peer", accentIndigo, Color.WHITE);
        callBtn.setEnabled(false);
        row2.add(callBtn);

        endCallBtn = createButton("End Call", accentRed, Color.WHITE);
        endCallBtn.setEnabled(false);
        row2.add(endCallBtn);

        topPanel.add(row1);
        topPanel.add(row2);
        frame.add(topPanel, BorderLayout.NORTH);

        // Center Panel: Left (Active Peers & In-Call Controls), Right (Live Chat & Signaling Log)
        JSplitPane splitPane = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT);
        splitPane.setDividerLocation(300);
        splitPane.setBackground(bgDark);

        // Left: Peer List
        JPanel leftPanel = new JPanel(new BorderLayout(8, 8));
        leftPanel.setBackground(bgCard);
        leftPanel.setBorder(new EmptyBorder(10, 10, 10, 10));
        leftPanel.add(createLabel("Active Room Peers", textWhite, 14, true), BorderLayout.NORTH);

        peerListModel = new DefaultListModel<>();
        JList<String> peerList = new JList<>(peerListModel);
        peerList.setBackground(new Color(15, 23, 42));
        peerList.setForeground(textWhite);
        peerList.setSelectionBackground(accentIndigo);
        peerList.setSelectionForeground(Color.WHITE);
        peerList.setFont(new Font("Monospaced", Font.PLAIN, 13));
        leftPanel.add(new JScrollPane(peerList), BorderLayout.CENTER);

        splitPane.setLeftComponent(leftPanel);

        // Right: Chat & Diagnostics Console
        JSplitPane rightSplit = new JSplitPane(JSplitPane.VERTICAL_SPLIT);
        rightSplit.setDividerLocation(260);

        // Chat Panel
        JPanel chatPanel = new JPanel(new BorderLayout(6, 6));
        chatPanel.setBackground(bgCard);
        chatPanel.setBorder(new EmptyBorder(10, 10, 10, 10));
        chatPanel.add(createLabel("In-Call Live Chat (Synchronized with WebRTC Peers)", textWhite, 13, true), BorderLayout.NORTH);

        chatArea = new JTextArea();
        chatArea.setEditable(false);
        chatArea.setBackground(new Color(15, 23, 42));
        chatArea.setForeground(textWhite);
        chatArea.setFont(new Font("SansSerif", Font.PLAIN, 13));
        chatPanel.add(new JScrollPane(chatArea), BorderLayout.CENTER);

        JPanel chatInputRow = new JPanel(new BorderLayout(6, 6));
        chatInputRow.setOpaque(false);
        chatInputField = new JTextField();
        styleTextField(chatInputField);
        chatInputRow.add(chatInputField, BorderLayout.CENTER);
        sendChatBtn = createButton("Send", accentIndigo, Color.WHITE);
        chatInputRow.add(sendChatBtn, BorderLayout.EAST);
        chatPanel.add(chatInputRow, BorderLayout.SOUTH);

        // Diagnostics Log Panel
        JPanel logPanel = new JPanel(new BorderLayout(6, 6));
        logPanel.setBackground(bgCard);
        logPanel.setBorder(new EmptyBorder(10, 10, 10, 10));
        logPanel.add(createLabel("Real-Time WebRTC Signaling Log & SDP Diagnostics", textMuted, 12, true), BorderLayout.NORTH);

        logArea = new JTextArea();
        logArea.setEditable(false);
        logArea.setBackground(new Color(10, 15, 26));
        logArea.setForeground(new Color(52, 211, 153)); // emerald-400
        logArea.setFont(new Font("Monospaced", Font.PLAIN, 12));
        logPanel.add(new JScrollPane(logArea), BorderLayout.CENTER);

        rightSplit.setTopComponent(chatPanel);
        rightSplit.setBottomComponent(logPanel);
        splitPane.setRightComponent(rightSplit);

        frame.add(splitPane, BorderLayout.CENTER);

        // Bottom Footer Bar
        JPanel footerBar = new JPanel(new BorderLayout(8, 0));
        footerBar.setBackground(bgDark);
        footerBar.setBorder(new EmptyBorder(6, 16, 8, 16));

        JLabel creditsLabel = createLabel("FlareCall • Developed by Sarwar Altaf Dar (https://github.com/techxsarwar)", textMuted, 11, false);
        JLabel licenseLabel = createLabel("GPLv3 Open Source", new Color(129, 140, 248), 11, true);
        footerBar.add(creditsLabel, BorderLayout.WEST);
        footerBar.add(licenseLabel, BorderLayout.EAST);
        frame.add(footerBar, BorderLayout.SOUTH);

        // Event Listeners
        connectBtn.addActionListener(e -> {
            String url = urlField.getText().trim();
            client.connect(url);
            connectBtn.setEnabled(false);
        });

        joinBtn.addActionListener(e -> {
            String room = roomField.getText().trim();
            if (!room.isEmpty()) {
                client.joinRoom(room);
            }
        });

        callBtn.addActionListener(e -> {
            String selected = peerList.getSelectedValue();
            if (selected != null && selected.contains("ID:")) {
                String targetId = selected.substring(selected.indexOf("ID:") + 3).trim();
                client.callPeer(targetId, selected.substring(0, selected.indexOf("(") != -1 ? selected.indexOf("(") : selected.length()).trim());
                callBtn.setEnabled(false);
                endCallBtn.setEnabled(true);
            } else {
                JOptionPane.showMessageDialog(frame, "Please select a peer from the list on the left to call.", "Select Peer", JOptionPane.INFORMATION_MESSAGE);
            }
        });

        endCallBtn.addActionListener(e -> {
            client.endCall();
            endCallBtn.setEnabled(false);
            callBtn.setEnabled(true);
        });

        sendChatBtn.addActionListener(e -> sendChat());
        chatInputField.addActionListener(e -> sendChat());

        frame.addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosing(WindowEvent e) {
                client.disconnect();
            }
        });

        frame.setVisible(true);
    }

    private void sendChat() {
        String txt = chatInputField.getText().trim();
        if (!txt.isEmpty()) {
            client.sendChatMessage(txt);
            chatInputField.setText("");
        }
    }

    private void startCli() {
        System.out.println("==================================================");
        System.out.println("     FlareCall Java Calling Client (CLI Mode)    ");
        System.out.println("   Author: Sarwar Altaf Dar (github.com/techxsarwar) ");
        System.out.println("   License: GNU General Public License v3.0 (GPLv3)");
        System.out.println("==================================================");
        System.out.println("Your Peer ID: " + client.getPeerId());
        System.out.println("Display Name: " + client.getDisplayName());

        Scanner scanner = new Scanner(System.in);
        System.out.print("Enter Cloudflare Signaling URL [wss://flare-call-signaling.aarifgmr.workers.dev/ws]: ");
        String url = scanner.nextLine().trim();
        if (url.isEmpty()) url = "wss://flare-call-signaling.aarifgmr.workers.dev/ws";

        client.connect(url).join();

        System.out.print("Enter Room ID to join [demo-room]: ");
        String room = scanner.nextLine().trim();
        if (room.isEmpty()) room = "demo-room";

        client.joinRoom(room);

        System.out.println("\nCommands: /call <peerId>, /accept <peerId>, /end, /chat <message>, /exit\n");

        while (true) {
            String line = scanner.nextLine().trim();
            if (line.equalsIgnoreCase("/exit")) {
                client.disconnect();
                break;
            } else if (line.startsWith("/call ")) {
                String targetId = line.substring(6).trim();
                client.callPeer(targetId, "User-" + targetId);
            } else if (line.startsWith("/accept ")) {
                String targetId = line.substring(8).trim();
                client.acceptCall(targetId);
            } else if (line.equalsIgnoreCase("/end")) {
                client.endCall();
            } else if (line.startsWith("/chat ")) {
                client.sendChatMessage(line.substring(6).trim());
            } else if (!line.isEmpty()) {
                client.sendChatMessage(line);
            }
        }
    }

    // Helper UI Stylers
    private static JLabel createLabel(String text, Color color) {
        return createLabel(text, color, 12, false);
    }

    private static JLabel createLabel(String text, Color color, int size, boolean bold) {
        JLabel label = new JLabel(text);
        label.setForeground(color);
        label.setFont(new Font("SansSerif", bold ? Font.BOLD : Font.PLAIN, size));
        return label;
    }

    private static JButton createButton(String text, Color bg, Color fg) {
        JButton btn = new JButton(text);
        btn.setBackground(bg);
        btn.setForeground(fg);
        btn.setFocusPainted(false);
        btn.setFont(new Font("SansSerif", Font.BOLD, 12));
        btn.setBorder(new EmptyBorder(7, 14, 7, 14));
        btn.setCursor(new Cursor(Cursor.HAND_CURSOR));
        return btn;
    }

    private static void styleTextField(JTextField tf) {
        tf.setBackground(new Color(15, 23, 42));
        tf.setForeground(Color.WHITE);
        tf.setCaretColor(Color.WHITE);
        tf.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(new Color(51, 65, 85)),
                new EmptyBorder(6, 8, 6, 8)
        ));
    }

    // ================= CallEventListener Callbacks =================

    @Override
    public void onSignalingConnected() {
        SwingUtilities.invokeLater(() -> {
            if (statusLabel != null) {
                statusLabel.setText("Connected to Edge");
                statusLabel.setForeground(new Color(52, 211, 153));
            }
            if (joinBtn != null) joinBtn.setEnabled(true);
        });
    }

    @Override
    public void onSignalingDisconnected(int statusCode, String reason) {
        SwingUtilities.invokeLater(() -> {
            if (statusLabel != null) {
                statusLabel.setText("Disconnected");
                statusLabel.setForeground(new Color(248, 113, 113));
            }
            if (joinBtn != null) joinBtn.setEnabled(false);
            if (callBtn != null) callBtn.setEnabled(false);
            if (endCallBtn != null) endCallBtn.setEnabled(false);
        });
    }

    @Override
    public void onRoomJoined(String roomId, String myPeerId, String myName) {
        SwingUtilities.invokeLater(() -> {
            if (statusLabel != null) {
                statusLabel.setText("In Room: " + roomId);
                statusLabel.setForeground(new Color(99, 102, 241));
            }
            if (callBtn != null) callBtn.setEnabled(true);
        });
    }

    @Override
    public void onPeerJoined(String peerId, String name) {
        SwingUtilities.invokeLater(() -> {
            if (peerListModel != null) {
                peerListModel.addElement(name + " (ID: " + peerId + ")");
            }
        });
    }

    @Override
    public void onPeerLeft(String peerId, String name) {
        SwingUtilities.invokeLater(() -> {
            if (peerListModel != null) {
                for (int i = 0; i < peerListModel.size(); i++) {
                    if (peerListModel.get(i).contains(peerId)) {
                        peerListModel.remove(i);
                        break;
                    }
                }
            }
        });
    }

    @Override
    public void onIncomingCall(String fromPeerId, String fromName) {
        SwingUtilities.invokeLater(() -> {
            int res = JOptionPane.showConfirmDialog(frame,
                    "Incoming WebRTC Call from " + fromName + "!\nAccept Call?",
                    "Incoming Call", JOptionPane.YES_NO_OPTION, JOptionPane.QUESTION_MESSAGE);
            if (res == JOptionPane.YES_OPTION) {
                client.acceptCall(fromPeerId);
                if (endCallBtn != null) endCallBtn.setEnabled(true);
            } else {
                client.declineCall(fromPeerId, "busy");
            }
        });
    }

    @Override
    public void onCallAccepted(String fromPeerId, String fromName) {
        SwingUtilities.invokeLater(() -> {
            if (statusLabel != null) {
                statusLabel.setText("In Call with " + fromName);
                statusLabel.setForeground(new Color(52, 211, 153));
            }
            if (endCallBtn != null) endCallBtn.setEnabled(true);
            if (callBtn != null) callBtn.setEnabled(false);
        });
    }

    @Override
    public void onCallDeclined(String fromPeerId, String reason) {
        SwingUtilities.invokeLater(() -> {
            JOptionPane.showMessageDialog(frame, "Call was declined: " + reason, "Call Declined", JOptionPane.INFORMATION_MESSAGE);
            if (endCallBtn != null) endCallBtn.setEnabled(false);
            if (callBtn != null) callBtn.setEnabled(true);
        });
    }

    @Override
    public void onCallEnded(String peerId) {
        SwingUtilities.invokeLater(() -> {
            if (statusLabel != null) {
                statusLabel.setText("In Room: " + client.getSession().getRoomId());
                statusLabel.setForeground(new Color(99, 102, 241));
            }
            if (endCallBtn != null) endCallBtn.setEnabled(false);
            if (callBtn != null) callBtn.setEnabled(true);
        });
    }

    @Override
    public void onRemoteSdpOffer(String fromPeerId, String sdp) {
        onLog("Remote SDP Offer received (" + sdp.length() + " chars). Ready for Answer.");
    }

    @Override
    public void onRemoteSdpAnswer(String fromPeerId, String sdp) {
        onLog("Remote SDP Answer received. P2P WebRTC Media Stream Establishing...");
    }

    @Override
    public void onRemoteIceCandidate(String fromPeerId, String candidateJson) {
        onLog("Remote ICE candidate exchanged: " + candidateJson);
    }

    @Override
    public void onChatMessage(String fromPeerId, String fromName, String text, long timestamp) {
        SwingUtilities.invokeLater(() -> {
            if (chatArea != null) {
                String time = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss"));
                chatArea.append("[" + time + "] " + fromName + ": " + text + "\n");
                chatArea.setCaretPosition(chatArea.getDocument().getLength());
            }
        });
    }

    @Override
    public void onPeerMediaStateChanged(String peerId, boolean audio, boolean video, boolean screen) {
        onLog("Peer " + peerId + " media update: Mic=" + (audio ? "ON" : "OFF") + ", Cam=" + (video ? "ON" : "OFF") + ", Screen=" + (screen ? "ON" : "OFF"));
    }

    @Override
    public void onError(String message, Throwable cause) {
        onLog("ERROR: " + message + (cause != null ? (" (" + cause.getMessage() + ")") : ""));
    }

    @Override
    public void onLog(String log) {
        SwingUtilities.invokeLater(() -> {
            if (logArea != null) {
                String time = LocalTime.now().format(DateTimeFormatter.ofPattern("HH:mm:ss"));
                logArea.append("[" + time + "] " + log + "\n");
                logArea.setCaretPosition(logArea.getDocument().getLength());
            }
        });
    }
}
