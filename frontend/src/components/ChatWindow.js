// src/components/ChatWindow.js
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import socket from "../socket";
import { useCall } from "../contexts/CallContext";
import "./ChatWindow.css";
import { API_URL } from "../config";

// Simple emoji list for picker
const EMOJI_LIST = [
  "😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂",
  "😉", "😌", "😍", "🥰", "😘", "😋", "😛", "😜", "🤪", "😝",
  "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶", "😏",
  "😒", "🙄", "😬", "😮", "😯", "😲", "😳", "🥺", "😢", "😭",
  "😤", "😠", "😡", "🤬", "😈", "👿", "💀", "💩", "🤡", "👹",
  "👍", "👎", "👋", "🤝", "👏", "🙌", "👐", "🤲", "🙏", "❤️",
  "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💯", "💢", "💥",
  "🔥", "✨", "🎉", "🎊", "💪", "🎈", "🎁", "🏆", "⭐", "🌟"
];

const ChatWindow = ({ selectedUser, onBack, isMobile, currentUser, isOnline }) => {
  // Call functionality
  const { startCall } = useCall();

  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [typingStatus, setTypingStatus] = useState("");
  const [userStatus, setUserStatus] = useState(isOnline ? "online" : "offline");
  const [lastSeen, setLastSeen] = useState(null);
  const typingTimeoutRef = useRef(null);

  const notificationSoundRef = useRef(new Audio("/notification.mp3"));
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const fileInputRef = useRef(null);
  const emojiPickerRef = useRef(null);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle file selection
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);

      // Create preview for images
      if (selectedFile.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => setFilePreview(e.target.result);
        reader.readAsDataURL(selectedFile);
      } else {
        setFilePreview(null);
      }
    }
  };

  // Clear file selection
  const clearFile = () => {
    setFile(null);
    setFilePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Add emoji to message
  const addEmoji = (emoji) => {
    setMessage((prev) => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Fetch messages & mark as read
  useEffect(() => {
    if (!selectedUser || !currentUser) return;

    const fetchMessages = async () => {
      try {
        const { data } = await axios.get(
          `${API_URL}/api/messages/get/${currentUser.userId}/${selectedUser._id}`,
          { withCredentials: true }
        );
        setMessages(data);

        socket.emit("markAsRead", {
          senderId: selectedUser._id,
          receiverId: currentUser.userId,
        });
      } catch (err) {
        console.error("Error fetching messages:", err);
      }
    };

    fetchMessages();
  }, [selectedUser, currentUser]);

  // Register socket listeners
  useEffect(() => {
    if (!currentUser) return;
    if (!socket.connected) socket.connect();
    socket.emit("register", currentUser.userId);

    const handleReceiveMessage = (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);

      if (newMessage.senderId !== currentUser.userId) {
        notificationSoundRef.current.play().catch(() => { });

        if (newMessage.senderId === selectedUser?._id) {
          socket.emit("markAsRead", {
            senderId: newMessage.senderId,
            receiverId: currentUser.userId,
          });
        }
      }
    };

    const handleStatusUpdate = ({ messageId, status }) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg._id === messageId ? { ...msg, status } : msg
        )
      );
    };

    const handleShowTyping = ({ senderId }) => {
      if (senderId === selectedUser?._id) {
        setTypingStatus("Typing...");
      }
    };

    const handleHideTyping = ({ senderId }) => {
      if (senderId === selectedUser?._id) {
        setTypingStatus("");
      }
    };

    const handleUserStatusUpdate = ({ userId, status, lastSeen }) => {
      if (userId === selectedUser?._id) {
        setUserStatus(status);
        if (status === 'offline') {
          setLastSeen(lastSeen);
        }
      }
    };

    socket.on("receiveMessage", handleReceiveMessage);
    socket.on("messageStatusUpdated", handleStatusUpdate);
    socket.on("showTyping", handleShowTyping);
    socket.on("hideTyping", handleHideTyping);
    socket.on("userStatusUpdate", handleUserStatusUpdate);

    return () => {
      socket.off("receiveMessage", handleReceiveMessage);
      socket.off("messageStatusUpdated", handleStatusUpdate);
      socket.off("showTyping", handleShowTyping);
      socket.off("hideTyping", handleHideTyping);
      socket.off("userStatusUpdate", handleUserStatusUpdate);
    };
  }, [selectedUser, currentUser]);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Send text or file message
  const sendMessage = async () => {
    if ((!message.trim() && !file) || !selectedUser) return;

    const form = new FormData();
    form.append("senderId", currentUser.userId);
    form.append("receiverId", selectedUser._id);
    form.append("message", message);
    if (file) form.append("file", file);

    try {
      const { data } = await axios.post(
        `${API_URL}/api/messages/send`,
        form,
        {
          headers: { "Content-Type": "multipart/form-data" },
          withCredentials: true
        }
      );

      socket.emit("sendMessage", data);
      setMessages((prev) => [...prev, data]);
      setMessage("");
      clearFile();
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);

    socket.emit("typing", { senderId: currentUser.userId, receiverId: selectedUser._id });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    typingTimeoutRef.current = setTimeout(() => {
      socket.emit("stopTyping", { senderId: currentUser.userId, receiverId: selectedUser._id });
    }, 2000);
  };

  // Voice message handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioFile = new File([audioBlob], "voice.webm", { type: "audio/webm" });

        // Send voice message
        const form = new FormData();
        form.append("senderId", currentUser.userId);
        form.append("receiverId", selectedUser._id);
        form.append("message", "");
        form.append("file", audioFile);

        try {
          const { data } = await axios.post(
            `${API_URL}/api/messages/send`,
            form,
            { headers: { "Content-Type": "multipart/form-data" }, withCredentials: true }
          );
          socket.emit("sendMessage", data);
          setMessages((prev) => [...prev, data]);
        } catch (err) {
          console.error("Error sending voice message:", err);
        }

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      alert("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  // Format time utility
  const formatTime = (timestamp) =>
    new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

  // Format date for separator
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${formatTime(timestamp)}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Render status ticks
  const statusIcon = (msg) => {
    if (msg.senderId !== currentUser.userId) return null;
    if (msg.status === "read") return <span className="tick read">✓✓</span>;
    if (msg.status === "delivered") return <span className="tick">✓✓</span>;
    if (msg.status === "sent") return <span className="tick">✓</span>;
    return null;
  };

  // Group messages by date
  const groupMessagesByDate = (messages) => {
    const groups = [];
    let currentDate = null;

    messages.forEach((msg, i) => {
      const msgDate = new Date(msg.timestamp).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ type: 'date', date: msg.timestamp, key: `date-${i}` });
      }
      groups.push({ type: 'message', ...msg, key: msg._id || `msg-${i}` });
    });

    return groups;
  };

  // Render individual message
  const renderMessage = (msg) => {
    const isSent = msg.senderId === currentUser.userId;
    return (
      <div key={msg.key} className={`message ${isSent ? "sent" : "received"}`}>
        {!isSent && (
          <div className="message-avatar">
            {selectedUser.username[0].toUpperCase()}
          </div>
        )}
        <div className="message-bubble">
          {msg.message && <p className="message-text">{msg.message}</p>}

          {msg.fileUrl && msg.fileType?.startsWith("image") && (
            <img
              className="message-image"
              src={msg.fileUrl}
              alt=""
              onClick={() => setPreviewImage(msg.fileUrl)}
            />
          )}

          {msg.fileUrl && msg.fileType?.startsWith("audio") && (
            <audio controls className="message-audio">
              <source src={msg.fileUrl} type={msg.fileType} />
            </audio>
          )}

          {msg.fileUrl && msg.fileType?.startsWith("video") && (
            <video controls className="message-video" style={{ maxWidth: "100%", borderRadius: "8px" }}>
              <source src={msg.fileUrl} type={msg.fileType} />
            </video>
          )}

          <div className="message-meta">
            <span className="message-time">{formatTime(msg.timestamp)}</span>
            {statusIcon(msg)}
          </div>
        </div>
      </div>
    );
  };

  const groupedMessages = groupMessagesByDate(messages);

  return (
    <div className="chat-window">
      {/* Header */}
      <div className="chat-header">
        {isMobile && typeof onBack === "function" && (
          <button className="back-btn" onClick={onBack}>
            <span className="material-icons">arrow_back</span>
          </button>
        )}

        <div className="header-avatar">
          {selectedUser?.username[0].toUpperCase()}
        </div>

        <div className="header-info">
          <h3 className="header-name">{selectedUser?.username || "Select a chat"}</h3>
          <span className={`header-status ${userStatus === 'online' ? 'online' : ''}`}>
            {typingStatus ? (
              <span className="typing-text">{typingStatus}</span>
            ) : userStatus === 'online' ? (
              'Online'
            ) : lastSeen ? (
              `Last seen ${new Date(lastSeen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
            ) : (
              'Offline'
            )}
          </span>
        </div>

        <div className="header-actions">
          <button
            className="action-btn"
            title="Video call"
            onClick={() => startCall(selectedUser, 'video')}
          >
            <span className="material-icons">videocam</span>
          </button>
          <button
            className="action-btn"
            title="Voice call"
            onClick={() => startCall(selectedUser, 'audio')}
          >
            <span className="material-icons">call</span>
          </button>
          <button className="action-btn" title="More">
            <span className="material-icons">more_vert</span>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="messages-container">
        {groupedMessages.map((item) =>
          item.type === 'date' ? (
            <div key={item.key} className="date-separator">
              <span>{formatDate(item.date)}</span>
            </div>
          ) : (
            renderMessage(item)
          )
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* File Preview */}
      {file && (
        <div className="file-preview-bar">
          {filePreview ? (
            <img src={filePreview} alt="Preview" className="file-preview-thumb" />
          ) : (
            <span className="material-icons">attach_file</span>
          )}
          <span className="file-name">{file.name}</span>
          <button className="clear-file-btn" onClick={clearFile}>
            <span className="material-icons">close</span>
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="input-container">
        <button className="input-btn" onClick={() => fileInputRef.current.click()}>
          <span className="material-icons">attach_file</span>
        </button>

        <input
          type="file"
          ref={fileInputRef}
          style={{ display: 'none' }}
          accept="image/*,audio/*,video/*,.pdf,.doc,.docx"
          onChange={handleFileSelect}
        />

        <div className="input-wrapper">
          <div className="emoji-container" ref={emojiPickerRef}>
            <button
              className="input-btn emoji-btn"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <span className="material-icons">sentiment_satisfied_alt</span>
            </button>

            {showEmojiPicker && (
              <div className="emoji-picker">
                {EMOJI_LIST.map((emoji, i) => (
                  <button key={i} className="emoji-item" onClick={() => addEmoji(emoji)}>
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          <input
            type="text"
            value={message}
            onChange={handleTyping}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
            placeholder="Type a message"
          />
        </div>

        {message.trim() || file ? (
          <button className="send-btn" onClick={sendMessage}>
            <span className="material-icons">send</span>
          </button>
        ) : (
          <button
            className={`mic-btn ${isRecording ? "recording" : ""}`}
            onClick={isRecording ? stopRecording : startRecording}
          >
            <span className="material-icons">{isRecording ? "stop" : "mic"}</span>
          </button>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
        <div className="image-modal" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Preview" />
        </div>
      )}
    </div>
  );
};

export default ChatWindow;
