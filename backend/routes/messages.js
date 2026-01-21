import express from "express";
import Message from "../models/Message.js";
import User from "../models/User.js";
import upload from "../middlewares/uploadMiddleware.js";
import { authenticateMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// router.post('/send', async (req, res) => {
//     try {
//         const { senderId, receiverId, message } = req.body;
//         const newMessage = new Message({ senderId, receiverId, message });
//         await newMessage.save();
//         res.status(201).json(newMessage);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

router.post("/send",authenticateMiddleware, upload.single("file"), async (req, res) => {
  const { senderId, receiverId, message } = req.body;
  let fileUrl = null;
  let fileType = null;

  if (req.file) {
    fileUrl = `/uploads/${req.file.filename}`;
    fileType = req.file.mimetype;
  }

  try {
    const newMessage = new Message({
      senderId,
      receiverId,
      message,
      fileUrl,
      fileType,
      status: "sent",
    });

    await newMessage.save();
    res.json(newMessage);
  } catch (error) {
    console.error("Error saving message:", error);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// router.get('/:userId', async (req, res) => {
//     try {
//         const { userId } = req.params;
//         const messages = await Message.find({ receiverId: userId }).populate('senderId', 'username');
//         res.status(200).json(messages);
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// });

router.get("/users",authenticateMiddleware, async (req, res) => {
  try {
    const users = await User.find().select("-password"); // remove passwords
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages between two users
router.get("/get/:senderId/:receiverId",authenticateMiddleware, async (req, res) => {
  const { senderId, receiverId } = req.params;
  try {
    const messages = await Message.find({
      $or: [
        { senderId, receiverId },
        { senderId: receiverId, receiverId: senderId },
      ],
    }).sort({ timestamp: 1 }); // Oldest to newest
    res.status(200).json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
