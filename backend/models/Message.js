import mongoose from 'mongoose';

// const messageSchema = new mongoose.Schema({
//     senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//     receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//     message: { type: String, required: true },
//     timestamp: { type: Date, default: Date.now }
// });

const messageSchema = new mongoose.Schema({
    senderId: { type: String, required: true },
    receiverId: { type: String, required: true },
    message: { type: String },
    fileUrl: { type: String },
    fileType: { type: String },
    status: { type: String, enum: ["sent", "delivered", "read"], default: "sent" },
    timestamp: { type: Date, default: Date.now },
  });

export default mongoose.model('Message', messageSchema);
