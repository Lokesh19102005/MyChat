// src/App.js
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Signup from './components/Signup';
import Login from './components/Login';
import Home from './components/Home';
import axios from 'axios';
import ForgetPassword from './components/ForgetPassword';
import ResetPassword from './components/ResetPassword';
import { CallProvider } from './contexts/CallContext';
import CallModal from './components/CallModal';
import './App.css';
import { API_URL } from "./config";

axios.defaults.withCredentials = true;   // 🔴 GLOBAL FIX

const App = () => {
    const [user, setUser] = useState(null); // user = {userId, email, username}
    const [loading, setLoading] = useState(true);

    // Auto-login on page refresh
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const res = await axios.get(`${API_URL}/api/auth/me`, {
                    withCredentials: true
                });
                setUser(res.data); // Set user if token is valid
            } catch (error) {
                setUser(null); // No valid session
            } finally {
                setLoading(false);
            }
        };
        checkAuth();
    }, []);

    if (loading) return (
        <div className="loading-screen">
            <div className="loading-spinner" />
            <p className="loading-text">MyChat</p>
            <style>{`
                .loading-screen {
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    background: #111b21;
                    gap: 20px;
                }
                .loading-spinner {
                    width: 40px;
                    height: 40px;
                    border: 3px solid #2f3b43;
                    border-top-color: #00a884;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                .loading-text {
                    margin: 0;
                    font-size: 16px;
                    color: #8696a0;
                    font-family: 'Inter', sans-serif;
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );

    // Wrap authenticated routes with CallProvider
    const AuthenticatedApp = () => (
        <CallProvider currentUser={user}>
            <Home user={user} setUser={setUser} />
            <CallModal />
        </CallProvider>
    );

    return (
        <Router>
            <Routes>
                <Route path="/" element={user ? <AuthenticatedApp /> : <Login setUser={setUser} />} />
                <Route path="/login" element={<Login setUser={setUser} />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/forget-password" element={<ForgetPassword />} />
                <Route path="/reset-password/:token" element={<ResetPassword />} />
            </Routes>
        </Router>
    );
};

export default App;
