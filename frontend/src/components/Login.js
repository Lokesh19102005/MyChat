// src/components/Login.js
import React, { useState } from 'react';
import axios from 'axios';
import './Login.css';
import { useNavigate } from 'react-router-dom';

const Login = ({ setUser }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    // const handleLogin = async (e) => {
    //     e.preventDefault();
    //     try {
    //         // 🔐 Step 1: Send login credentials
    //         await axios.post(
    //             'http://localhost:5000/api/auth/login',
    //             { email, password },
    //             { withCredentials: true } // 👈 Send cookie back
    //         );

    //         // 🔍 Step 2: Fetch user details using /me route
    //         const res = await axios.get('http://localhost:5000/api/auth/me',{
    //             withCredentials : true
    //         });

    //         console.log("Logged in as:", res.data.username);

    //         // ✅ Step 3: Store user data in parent/global state
    //         // setUser(res.data); // { userId, username, email }

    //         // 🚀 Step 4: Redirect to /home
    //         // navigate('/');

    //         const { userId, username, email } = res.data || {};
    //         if (userId && username && email) {
    //             setUser({ userId, username, email });
    //             navigate('/');
    //         } else {
    //            alert("res is not working");
    //         }
    //     } 
    //     catch (error) {
    //         console.error("Login flow error:", error);
    //         console.error("Response data:", error.response?.data);
    //         alert(error.response?.data?.error || 'Login failed');
    //     }
    // };

    const handleLogin = async (e) => {
        e.preventDefault();

        try {
            // 1️⃣ login
            const { data } = await axios.post(
                "http://localhost:5000/api/auth/login",
                { email, password },
                { withCredentials: true }
            );
            console.log("✅ Login succeeded");

        } catch (err) {
            console.error("Login error:", err.response?.data);
            return alert(err.response?.data?.error || 'Login failed');
        }

        try {
            // 2️⃣ fetch /me
            const res = await axios.get(
                'http://localhost:5000/api/auth/me',
                { withCredentials: true }
            );
            console.log("✅ /me response:", res.data);

            const { userId, username, email } = res.data;
            setUser({ userId, username, email });
            navigate('/');
        } catch (err) {
            console.error("/me error:", err.response?.data);
            alert(err.response?.data?.error || 'Could not fetch profile');
        }
    };


    return (
        <div className="login-container">
            <form className="login-form" onSubmit={handleLogin}>
                <h2>Login</h2>
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
                <button type="submit">Login</button>

                <div className='forget-pass'>
                    Forgot Password? <span className='reset-link' onClick={() => navigate("/forget-password")}> Reset</span>
                </div>

                <div className="signup-redirect">
                    Don't have an account? <span className="signup-link" onClick={() => navigate('/signup')}>Sign Up</span>
                </div>
            </form>
        </div>
    );
};

export default Login;
