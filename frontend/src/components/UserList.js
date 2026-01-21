// src/components/UserList.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import socket from '../socket';
import './UserList.css';

// Generate consistent color from username
const getAvatarColor = (name) => {
  const colors = [
    '#00a884', '#25d366', '#128c7e', '#075e54',
    '#34b7f1', '#00bcd4', '#7c4dff', '#536dfe',
    '#ff6d00', '#ff3d00', '#e91e63', '#9c27b0'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const UserList = ({ selectUser, currentUser, selectedUser, onUserSelect }) => {
  const [users, setUsers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await axios.get('http://10.162.129.105:5000/api/messages/users', {
          withCredentials: true,
        });
        const filtered = res.data.filter((user) => user._id !== currentUser.userId);
        setUsers(filtered);
      } catch (error) {
        console.error('Error fetching users:', error);
      }
    };
    fetchUsers();
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      socket.emit('register', currentUser.userId);
    }

    socket.on('onlineUsers', (userIds) => {
      setOnlineUsers(userIds);
    });

    return () => {
      socket.off('onlineUsers');
    };
  }, [currentUser]);

  const handleUserClick = (user) => {
    const isOnline = onlineUsers.includes(user._id);
    selectUser(user);
    if (onUserSelect) {
      onUserSelect(user, isOnline);
    }
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="chat-list">
      {/* Tabs */}
      <div className="chat-list-tabs">
        <button
          className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
        >
          All Chats
        </button>
        <button
          className={`tab-btn ${activeTab === 'groups' ? 'active' : ''}`}
          onClick={() => setActiveTab('groups')}
        >
          Groups
        </button>
        <button
          className={`tab-btn ${activeTab === 'contacts' ? 'active' : ''}`}
          onClick={() => setActiveTab('contacts')}
        >
          Contacts
        </button>
      </div>

      {/* Search */}
      <div className="chat-list-search">
        <span className="material-icons search-icon">search</span>
        <input
          type="text"
          placeholder="Search or start new chat"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* User List */}
      <div className="chat-list-users">
        {filteredUsers.map((user) => {
          const isOnline = onlineUsers.includes(user._id);
          const avatarColor = getAvatarColor(user.username);

          return (
            <div
              key={user._id}
              className={`chat-item ${selectedUser?._id === user._id ? 'active' : ''}`}
              onClick={() => handleUserClick(user)}
            >
              <div className="chat-item-avatar">
                <div className="avatar" style={{ background: avatarColor }}>
                  {user.username[0].toUpperCase()}
                </div>
                {isOnline && <span className="online-indicator" />}
              </div>

              <div className="chat-item-content">
                <div className="chat-item-header">
                  <span className="chat-item-name">{user.username}</span>
                  <span className="chat-item-time">
                    {isOnline ? 'Online' : ''}
                  </span>
                </div>
                <div className="chat-item-preview">
                  <span className="preview-text">
                    {isOnline ? '🟢 Active now' : 'Tap to chat'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Calls Section */}
      <div className="calls-section">
        <div className="calls-header">
          <span className="calls-title">Calls</span>
          <button className="new-meet-btn">
            <span className="material-icons">add_circle_outline</span>
            New Meet
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserList;
