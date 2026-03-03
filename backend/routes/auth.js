import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { Resend } from 'resend';
import User from '../models/User.js';
import { authenticateMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Initialize Resend conditionally so server doesn't crash if .env is missing the key
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// SIGNUP ROUTE
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ username, email, password: hashedPassword });
        await newUser.save();

        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// LOGIN ROUTE
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log("Login attempt for:", email);

        const user = await User.findOne({ email });
        console.log("User found:", user);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

        console.log("SIGN secret:", process.env.JWT_SECRET);

        // Create JWT Token
        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Send token in httpOnly cookie
        // res.cookie('token', token, {
        //     httpOnly: true,
        //     secure: process.env.NODE_ENV === 'production',
        //     sameSite: 'strict',
        //     maxAge: 60 * 60 * 1000 // 1 hour
        // });
        // res.setHeader("Access-Control-Allow-Credentials", "true");

        // res.cookie("token", token, {
        //     httpOnly: true,
        //     secure: true,        // 🔴 REQUIRED on Render
        //     sameSite: "none",   // 🔴 REQUIRED for cross-site cookies
        //     path: "/",
        //     maxAge: 7 * 24 * 60 * 60 * 1000 // optional (7 days)
        // });

        res.status(200).json({ message: 'Login successful', token });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// LOGOUT ROUTE
router.post('/logout', (req, res) => {
    // res.clearCookie('token', {
    //     httpOnly: true,
    //     secure: false,
    //     sameSite: "lax"
    // });
    res.status(200).json({ message: 'Logged out successfully' });
});

// 👇 /me route
router.get('/me', authenticateMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('username email _id');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({
            userId: user._id,
            email: user.email,
            username: user.username
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// FORGET PASSWORD ROUTE
router.post('/forget-password', async (req, res) => {
    console.log("🔹 Forget Password Route Hit");
    console.log("🔹 Request Body:", req.body);

    try {
        const { email } = req.body;

        if (!email) {
            console.log("❌ Email missing in request body");
            return res.status(400).json({ error: 'Email is required' });
        }

        console.log("🔹 Searching for user with email:", email);
        const user = await User.findOne({ email });

        if (!user) {
            console.log("❌ User not found for email:", email);
            return res.status(404).json({ error: 'User with this email does not exist' });
        }

        console.log("✅ User found:", user.username);

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Save token and expiry (valid for 15 minutes)
        user.passwordResetToken = hashedToken;
        user.passwordResetExpires = Date.now() + 15 * 60 * 1000;
        await user.save();
        console.log("✅ Reset token saved to database");

        // Create reset link
        const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        console.log("🔹 Generated Reset Link:", resetLink);

        // Send email using Resend
        console.log("🔹 Attempting to send email with Resend...");

        if (!resend) {
            console.error("❌ Resend API Key is missing in environment variables.");
            return res.status(500).json({ error: "Email service is not configured. Missing API key." });
        }

        try {
            const { data, error } = await resend.emails.send({
                from: "noreply@talkopia.in",
                to: email,
                subject: 'Password Reset Request - MyChat',
                html: `
                    <h2>Password Reset Request</h2>
                    <p>You requested to reset your password. Click the link below to reset it:</p>
                    <a href="${resetLink}" style="background-color: #4caf50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
                        Reset Password
                    </a>
                    <p>This link will expire in 15 minutes.</p>
                    <p>If you didn't request this, please ignore this email.</p>
                `
            });

            if (error) {
                console.error("❌ Email sending failed:", error);
                return res.status(500).json({ error: "Failed to send email. Check server logs." });
            }

            console.log('✅ Password reset email sent successfully to:', email, 'Data:', data);
            res.status(200).json({ message: 'Password reset link sent to your email' });
        } catch (emailError) {
            console.error("❌ Email sending exception:", emailError);
            return res.status(500).json({ error: "Failed to send email. Check server logs." });
        }

    } catch (error) {
        console.error("❌ Error in forget-password route:", error);
        res.status(500).json({ error: error.message });
    }
});

// RESET PASSWORD ROUTE
router.post('/reset-password/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { password } = req.body;

        if (!password) {
            return res.status(400).json({ error: 'New password is required' });
        }

        // Hash the token to compare
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        // Find user with valid token
        const user = await User.findOne({
            passwordResetToken: hashedToken,
            passwordResetExpires: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update password and clear reset token
        user.password = hashedPassword;
        user.passwordResetToken = null;
        user.passwordResetExpires = null;
        await user.save();

        res.status(200).json({ message: 'Password reset successfully. Please login with your new password.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
