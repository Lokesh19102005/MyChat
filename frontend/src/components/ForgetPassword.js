// src/components/ForgetPassword.js
import React, { useState } from 'react';
import axios from 'axios';
import './ForgetPassword.css';
import { useNavigate } from 'react-router-dom';

const ForgetPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const res = await axios.post('http://localhost:5000/api/auth/forget-password', {
                email
            });

            setSuccessMessage(res.data.message || 'Password reset link has been sent to your email!');
            setEmail('');

            // Redirect to login after 3 seconds
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (error) {
            setErrorMessage(error.response?.data?.error || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="forget-password-container">
            <form className="forget-password-form" onSubmit={handleSubmit}>
                <h2>Reset Password</h2>
                <p className="forget-password-description">
                    Enter your email address and we'll send you a link to reset your password.
                </p>

                <input
                    type="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                />

                {errorMessage && <div className="error-message">{errorMessage}</div>}
                {successMessage && <div className="success-message">{successMessage}</div>}

                <button type="submit" disabled={loading}>
                    {loading ? 'Sending...' : 'Send Reset Link'}
                </button>

                <div className="back-to-login">
                    <span onClick={() => navigate('/login')} className="back-link">
                        Back to Login
                    </span>
                </div>
            </form>
        </div>
    );
};

export default ForgetPassword;
