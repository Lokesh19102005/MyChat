// src/components/ResetPassword.js
import React, { useState } from 'react';
import axios from 'axios';
import './ResetPassword.css';
import { useNavigate, useParams } from 'react-router-dom';
import { API_URL } from "../config";

const ResetPassword = () => {
    const { token } = useParams();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setErrorMessage('');
        setSuccessMessage('');

        // Validate passwords match
        if (password !== confirmPassword) {
            setErrorMessage('Passwords do not match');
            return;
        }

        // Validate password length
        if (password.length < 6) {
            setErrorMessage('Password must be at least 6 characters long');
            return;
        }

        setLoading(true);

        try {
            const res = await axios.post(`${API_URL}/api/auth/reset-password/${token}`, {
                password
            });

            setSuccessMessage(res.data.message || 'Password reset successfully!');
            setPassword('');
            setConfirmPassword('');

            // Redirect to login after 2 seconds
            setTimeout(() => {
                navigate('/login');
            }, 2000);
        } catch (error) {
            setErrorMessage(error.response?.data?.error || 'Failed to reset password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="reset-password-container">
            <form className="reset-password-form" onSubmit={handleSubmit}>
                <h2>Create New Password</h2>
                <p className="reset-password-description">
                    Please enter your new password below.
                </p>

                <input
                    type="password"
                    placeholder="New Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                />

                <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={loading}
                />

                {errorMessage && <div className="error-message">{errorMessage}</div>}
                {successMessage && <div className="success-message">{successMessage}</div>}

                <button type="submit" disabled={loading}>
                    {loading ? 'Resetting...' : 'Reset Password'}
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

export default ResetPassword;
