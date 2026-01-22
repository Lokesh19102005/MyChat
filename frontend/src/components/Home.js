// src/components/Home.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import UserList from './UserList';
import Sidebar from './Sidebar';
import ChatWindow from './ChatWindow';
import './Home.css';
import { API_URL } from "../config";

const Home = ({ user, setUser }) => {
  const [selectedUser, setSelectedUser] = useState(null);
  const [isSelectedUserOnline, setIsSelectedUserOnline] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Apply theme to body
  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
      document.body.classList.remove('dark-theme');
    } else {
      document.body.classList.add('dark-theme');
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleLogout = async () => {
    try {
      await axios.post(`${API_URL}/api/auth/logout`, {}, { withCredentials: true });
    } catch (err) {
      // Ignore errors
      console.log(err);
    }
    if (typeof setUser === 'function') setUser(null);
    window.location.href = '/';
  };

  const handleUserSelect = (user, isOnline) => {
    setSelectedUser(user);
    setIsSelectedUserOnline(isOnline);
  };

  return (
    <div className={`home-container ${theme}-theme`}>
      {/* Sidebar */}
      {(!isMobile || !selectedUser) && (
        <Sidebar
          onLogout={handleLogout}
          onToggleTheme={handleToggleTheme}
          theme={theme}
        />
      )}

      {/* Chat List */}
      {(!isMobile || !selectedUser) && (
        <UserList
          selectUser={setSelectedUser}
          currentUser={user}
          selectedUser={selectedUser}
          onUserSelect={handleUserSelect}
        />
      )}

      {/* Chat Area */}
      <div className="chat-area">
        {selectedUser ? (
          <ChatWindow
            selectedUser={selectedUser}
            onBack={() => setSelectedUser(null)}
            isMobile={isMobile}
            currentUser={user}
            isOnline={isSelectedUserOnline}
          />
        ) : (
          <div className="welcome-screen">
            <div className="welcome-content">
              <div className="welcome-icon">
                <span className="material-icons">chat</span>
              </div>
              <h2>MyChat Web</h2>
              <p>Send and receive messages without keeping your phone online.</p>
              <p className="welcome-hint">Select a chat to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
