import 'dotenv/config';
import path from 'path';

import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mongoose from 'mongoose';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import messageRoutes from './routes/messages.js';
import { fileURLToPath } from "url";
import User from './models/User.js';
import Message from './models/Message.js';
import Call from './models/Call.js';
import cookieParser from 'cookie-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

const io = new Server(server, {
    cors: {
        origin: CLIENT_URL,
        methods: ['GET', 'POST'],
        credentials: true
    }
});


app.use(cors({
    origin: CLIENT_URL,
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());

app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
// Make uploads folder public
// app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
//     setHeaders: function (res, filePath) {
//         if (filePath.endsWith('.mp3')) {
//             res.setHeader('Content-Type', 'audio/mpeg');
//         } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
//             res.setHeader('Content-Type', 'image/jpeg');
//         } else if (filePath.endsWith('.png')) {
//             res.setHeader('Content-Type', 'image/png');
//         }
//     }
// }));

// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));

// 🟢 SOCKET.IO setup
// io.on('connection', (socket) => {
//     console.log('A user connected:', socket.id);

//     // Listen for message event
//     socket.on('sendMessage', ({ senderId, receiverId, message }) => {

//         console.log("s = ",senderId," , r = ",receiverId," , m = ",message);
//         // Broadcast message to the receiver only
//         io.to(receiverId).emit('receiveMessage', {
//             senderId,
//             message,
//             timestamp: new Date()
//         });
//     });

//     // Join a room with user ID (optional for targeting messages)
//     socket.on('join', (userId) => {
//         socket.join(userId);
//         console.log(`${userId} joined their room`);
//     });

//     socket.on('disconnect', () => {
//         console.log('User disconnected:', socket.id);
//     });
// });


const users = {}; // userId -> socketId map

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Custom event to register userId with this socket
    socket.on('register', async (userId) => {
        users[userId] = socket.id;

        // Update user status
        await User.findByIdAndUpdate(userId, { isOnline: true });

        io.emit('onlineUsers', Object.keys(users)); // 👈 broadcast updated online users
        io.emit('userStatusUpdate', { userId, status: 'online' });

        console.log(`User ${userId} registered with socket ${socket.id}`);

        // 🔄 Mark messages as delivered for this user
        const undeliveredMessages = await Message.find({
            receiverId: userId,
            status: 'sent'
        });

        for (const msg of undeliveredMessages) {
            msg.status = 'delivered';
            await msg.save();

            const senderSocketId = users[msg.senderId];
            if (senderSocketId) {
                io.to(senderSocketId).emit('messageStatusUpdated', {
                    messageId: msg._id,
                    status: 'delivered'
                });
            }
        }
    });

    // 🔁 Send Message
    socket.on('sendMessage', (messageData) => {
        const { senderId, receiverId } = messageData;

        const receiverSocketId = users[receiverId];
        const status = receiverSocketId ? "delivered" : "sent";

        // 1. 👇 Emit to receiver if online
        if (receiverSocketId) {
            io.to(receiverSocketId).emit('receiveMessage', {
                ...messageData,
                status
            });
        }

        // 2. 👇 Emit to sender to update message status
        const senderSocketId = users[senderId];
        if (senderSocketId) {
            io.to(senderSocketId).emit('messageStatusUpdated', {
                messageId: messageData._id,
                status
            });
        }
    });


    // 📩 Typing events
    socket.on("typing", ({ senderId, receiverId }) => {
        const receiverSocketId = users[receiverId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("showTyping", { senderId });
        }
    });

    socket.on("stopTyping", ({ senderId, receiverId }) => {
        const receiverSocketId = users[receiverId];
        if (receiverSocketId) {
            io.to(receiverSocketId).emit("hideTyping", { senderId });
        }
    });

    // ✅ Read Receipt
    socket.on("markAsRead", async ({ senderId, receiverId }) => {
        const unreadMessages = await Message.find({
            senderId,
            receiverId,
            status: { $in: ["sent", "delivered"] }
        });

        for (const msg of unreadMessages) {
            msg.status = "read";
            await msg.save();

            const senderSocketId = users[senderId];
            if (senderSocketId) {
                io.to(senderSocketId).emit("messageStatusUpdated", {
                    messageId: msg._id,
                    status: "read"
                });
            }
        }
    });

    // ========================================
    // 📞 CALL SIGNALING EVENTS
    // ========================================

    // Store active calls
    if (!global.activeCalls) {
        global.activeCalls = {};
    }

    // 📞 Call Invite
    socket.on('call:invite', async (data) => {
        const { callId, from, to, callType } = data;
        console.log(`📞 Call invite: ${from} -> ${to} (${callType})`);

        const calleeSocketId = users[to];

        // Store call in active calls
        global.activeCalls[callId] = {
            callId,
            callerId: from,
            calleeId: to,
            callType,
            status: 'ringing',
            startTime: null
        };

        // Save call to database
        try {
            const call = new Call({
                callId,
                callerId: from,
                calleeId: to,
                callType,
                status: 'initiated'
            });
            await call.save();
        } catch (err) {
            console.error('Error saving call:', err);
        }

        if (calleeSocketId) {
            // User is online, send invite
            io.to(calleeSocketId).emit('call:incoming', {
                callId,
                from,
                to,
                callType
            });

            // Notify caller that it's ringing
            const callerSocketId = users[from];
            if (callerSocketId) {
                io.to(callerSocketId).emit('call:ringing', { callId });
            }

            // Set timeout for missed call (30 seconds)
            setTimeout(async () => {
                const call = global.activeCalls[callId];
                if (call && call.status === 'ringing') {
                    // Mark as missed
                    call.status = 'missed';

                    // Update database
                    await Call.findOneAndUpdate(
                        { callId },
                        { status: 'missed', reason: 'no_answer' }
                    );

                    // Notify both parties
                    io.to(calleeSocketId).emit('call:missed', { callId });
                    if (callerSocketId) {
                        io.to(callerSocketId).emit('call:timeout', { callId });
                    }

                    delete global.activeCalls[callId];
                }
            }, 30000);
        } else {
            // User is offline
            const callerSocketId = users[from];
            if (callerSocketId) {
                io.to(callerSocketId).emit('call:unavailable', { callId, to });
            }

            // Mark as missed in database
            await Call.findOneAndUpdate(
                { callId },
                { status: 'missed', reason: 'user_offline' }
            );

            delete global.activeCalls[callId];
        }
    });

    // ✅ Call Accept
    socket.on('call:accept', async (data) => {
        const { callId, from, to } = data;
        console.log(`✅ Call accepted: ${from} accepted call from ${to}`);

        const call = global.activeCalls[callId];
        if (call) {
            call.status = 'ongoing';
            call.startTime = Date.now();
        }

        // Update database
        await Call.findOneAndUpdate(
            { callId },
            { status: 'ongoing', startedAt: new Date() }
        );

        // Notify caller
        const callerSocketId = users[to];
        if (callerSocketId) {
            io.to(callerSocketId).emit('call:accepted', { callId, from });
        }
    });

    // ❌ Call Reject
    socket.on('call:reject', async (data) => {
        const { callId, from, to, reason } = data;
        console.log(`❌ Call rejected: ${from} rejected call from ${to}`);

        // Update database
        await Call.findOneAndUpdate(
            { callId },
            { status: 'rejected', reason: reason || 'user_rejected' }
        );

        // Notify caller
        const callerSocketId = users[to];
        if (callerSocketId) {
            io.to(callerSocketId).emit('call:rejected', { callId, reason });
        }

        delete global.activeCalls[callId];
    });

    // 📡 SDP Exchange (Offer/Answer)
    socket.on('call:sdp', (data) => {
        const { callId, from, to, sdp, type } = data;
        console.log(`📡 SDP ${type}: ${from} -> ${to}`);

        const targetSocketId = users[to];
        if (targetSocketId) {
            io.to(targetSocketId).emit('call:sdp', { callId, from, sdp, type });
        }
    });

    // 🧊 ICE Candidate Exchange
    socket.on('call:ice-candidate', (data) => {
        const { callId, from, to, candidate } = data;

        const targetSocketId = users[to];
        if (targetSocketId) {
            io.to(targetSocketId).emit('call:ice-candidate', { callId, from, candidate });
        }
    });

    // 🔚 Call End
    socket.on('call:end', async (data) => {
        const { callId, from, to, reason } = data;
        console.log(`🔚 Call ended: ${callId}, reason: ${reason}`);

        const call = global.activeCalls[callId];
        let duration = 0;

        if (call && call.startTime) {
            duration = Math.floor((Date.now() - call.startTime) / 1000);
        }

        // Update database
        await Call.findOneAndUpdate(
            { callId },
            {
                status: 'completed',
                endedAt: new Date(),
                duration,
                reason: reason || 'user_hangup'
            }
        );

        // Notify other party
        const targetSocketId = users[to];
        if (targetSocketId) {
            io.to(targetSocketId).emit('call:ended', { callId, reason, duration });
        }

        delete global.activeCalls[callId];
    });

    // 🔇 Call Controls (mute/unmute, camera toggle)
    socket.on('call:control', (data) => {
        const { callId, from, to, action, value } = data;

        const targetSocketId = users[to];
        if (targetSocketId) {
            io.to(targetSocketId).emit('call:control', { callId, from, action, value });
        }
    });

    // 📋 Get Call History
    socket.on('call:getHistory', async (data) => {
        const { userId } = data;

        try {
            const calls = await Call.find({
                $or: [{ callerId: userId }, { calleeId: userId }]
            })
                .sort({ createdAt: -1 })
                .limit(50)
                .populate('callerId', 'username')
                .populate('calleeId', 'username');

            socket.emit('call:history', { calls });
        } catch (err) {
            console.error('Error fetching call history:', err);
            socket.emit('call:history', { calls: [], error: err.message });
        }
    });

    // ❌ Disconnect
    socket.on('disconnect', async () => {
        // Clean up any active calls for this user
        for (const callId in global.activeCalls) {
            const call = global.activeCalls[callId];
            const disconnectedUserId = Object.keys(users).find(id => users[id] === socket.id);

            if (call && (call.callerId === disconnectedUserId || call.calleeId === disconnectedUserId)) {
                const otherUserId = call.callerId === disconnectedUserId ? call.calleeId : call.callerId;
                const otherSocketId = users[otherUserId];

                if (otherSocketId) {
                    io.to(otherSocketId).emit('call:ended', {
                        callId,
                        reason: 'user_disconnected'
                    });
                }

                delete global.activeCalls[callId];
            }
        }

        let disconnectedUserId = null;
        for (const userId in users) {
            if (users[userId] === socket.id) {
                disconnectedUserId = userId;
                delete users[userId];
                break;
            }
        }

        if (disconnectedUserId) {
            const lastSeen = new Date();
            await User.findByIdAndUpdate(disconnectedUserId, {
                isOnline: false,
                lastSeen: lastSeen
            });

            io.emit('userStatusUpdate', {
                userId: disconnectedUserId,
                status: 'offline',
                lastSeen
            });
        }

        console.log('A user disconnected:', socket.id);
        io.emit('onlineUsers', Object.keys(users));
    });
});


const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
