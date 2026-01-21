// src/components/Signup.js
import React, { useState } from 'react';
import axios from 'axios';
import './Signup.css'; // 👈 import CSS
import { useNavigate } from 'react-router-dom';

const Signup = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleSignup = async (e) => {
        e.preventDefault();
        try {
            const res = await axios.post('http://10.162.129.105:5000/api/auth/signup', {
                username, email, password
            });
            alert(res.data.message);
        } catch (error) {
            alert(error.response.data.error);
        }
    };

    return (
        <div className="signup-container">
            <form className="signup-form" onSubmit={handleSignup}>
                <h2>Signup</h2>
                <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                />
                <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />
                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                />
                <button type="submit">Signup</button>

                <div className="login-redirect">
                    Already have an account? <span className="login-link" onClick={() => navigate('/login')}>Login</span>
                </div>
            </form>
        </div>
    );
};

export default Signup;
