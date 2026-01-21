import mongoose from 'mongoose';

const callSchema = new mongoose.Schema({
    callId: {
        type: String,
        required: true,
        unique: true
    },
    callerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    calleeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    callType: {
        type: String,
        enum: ['audio', 'video'],
        required: true
    },
    status: {
        type: String,
        enum: ['initiated', 'ringing', 'ongoing', 'completed', 'missed', 'rejected', 'failed'],
        default: 'initiated'
    },
    startedAt: {
        type: Date
    },
    endedAt: {
        type: Date
    },
    duration: {
        type: Number, // in seconds
        default: 0
    },
    reason: {
        type: String // 'user_hangup', 'user_rejected', 'no_answer', 'network_error'
    }
}, {
    timestamps: true
});

// Virtual to calculate duration
callSchema.methods.calculateDuration = function () {
    if (this.startedAt && this.endedAt) {
        return Math.floor((this.endedAt - this.startedAt) / 1000);
    }
    return 0;
};

const Call = mongoose.model('Call', callSchema);

export default Call;
