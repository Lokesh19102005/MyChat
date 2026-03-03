import React from "react";
import "./Sidebar.css";

function Sidebar({ onToggleTheme, onLogout, theme, onToggleAI }) {
  return (
    <div className="sidebar">
      <div className="sidebar-top">
        <button className="sidebar-btn active" title="Home">
          <span className="material-icons">home</span>
          <span className="sidebar-label">Home</span>
        </button>

        <button className="sidebar-btn" title="Search">
          <span className="material-icons">search</span>
          <span className="sidebar-label">Search</span>
        </button>

        <button className="sidebar-btn" title="Save">
          <span className="material-icons">bookmark_border</span>
          <span className="sidebar-label">Save</span>
        </button>

        <button className="sidebar-btn" title="Share">
          <span className="material-icons">ios_share</span>
          <span className="sidebar-label">Share</span>
        </button>

        <button className="sidebar-btn" title="AI Assistant" onClick={onToggleAI}>
          <span className="material-icons" style={{ color: '#00a884' }}>auto_awesome</span>
          <span className="sidebar-label" style={{ color: '#00a884' }}>AI</span>
        </button>
      </div>

      <div className="sidebar-bottom">
        <button className="sidebar-btn" title="Toggle Theme" onClick={onToggleTheme}>
          <span className="material-icons">
            {theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
          <span className="sidebar-label">Theme</span>
        </button>

        <button className="sidebar-btn logout-btn" title="Logout" onClick={onLogout}>
          <span className="material-icons">power_settings_new</span>
        </button>
      </div>
    </div>
  );
}

export default Sidebar;
