// src/contexts/CallContext.js
import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import socket from '../socket';

const CallContext = createContext();

// ICE Servers configuration
// const ICE_SERVERS = {
//     iceServers: [
//         { urls: 'stun:stun.l.google.com:19302' },
//         { urls: 'stun:stun1.l.google.com:19302' },
//         { urls: 'stun:stun2.l.google.com:19302' },
//         {
//             urls: 'turn:turn.yourdomain.com:3478',
//             username: 'user',
//             credential: 'pass'
//         }
//     ]
// };

// ICE Servers configuration (UPDATED)
const ICE_SERVERS = {
    iceServers: [
        // Metered STUN (firewall friendly)
        {
            urls: "stun:stun.relay.metered.ca:80"
        },

        // Metered TURN servers
        {
            urls: [
                "turn:global.relay.metered.ca:80",
                "turn:global.relay.metered.ca:80?transport=tcp",
                "turn:global.relay.metered.ca:443",
                "turns:global.relay.metered.ca:443?transport=tcp"
            ],
            username: "7a76be2c6877c91b25aeea50",
            credential: "AmHDNezfpq/H3EWl" // ← paste EXACT value from dashboard
        }
    ]
};


export const CallProvider = ({ children, currentUser }) => {
    // Register socket with current user
    useEffect(() => {
        if (currentUser?.userId) {
            console.log('📞 CallContext: Registering socket for user:', currentUser.userId);
            socket.emit('register', currentUser.userId);
        }
    }, [currentUser]);

    // Call state
    const [callState, setCallState] = useState('idle');
    const [callType, setCallType] = useState(null);
    const [callId, setCallId] = useState(null);
    const [remoteUser, setRemoteUser] = useState(null);
    const [callDuration, setCallDuration] = useState(0);
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(false);
    const [callEndReason, setCallEndReason] = useState(null);

    // WebRTC refs
    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const durationIntervalRef = useRef(null);
    const pendingCandidatesRef = useRef([]);

    // Store current callId and remoteUser in refs for use in callbacks
    const callIdRef = useRef(null);
    const remoteUserRef = useRef(null);

    // Update refs when state changes
    useEffect(() => { callIdRef.current = callId; }, [callId]);
    useEffect(() => { remoteUserRef.current = remoteUser; }, [remoteUser]);

    // Stream states for UI
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);

    // Generate unique call ID
    const generateCallId = () => {
        return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    // Get remote user ID helper
    const getRemoteUserId = (user) => {
        if (!user) return null;
        return typeof user === 'object' ? user._id : user;
    };

    // Cleanup function
    const cleanup = useCallback(() => {
        console.log('📞 Cleanup called');

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop());
            localStreamRef.current = null;
            setLocalStream(null);
        }

        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        if (durationIntervalRef.current) {
            clearInterval(durationIntervalRef.current);
            durationIntervalRef.current = null;
        }

        pendingCandidatesRef.current = [];
        setRemoteStream(null);
        remoteStreamRef.current = null;
    }, []);

    // Get media stream
    const getMediaStream = async (type) => {
        console.log('📞 getMediaStream:', type);

        try {
            const constraints = { audio: true, video: type === 'video' };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            localStreamRef.current = stream;
            setLocalStream(stream);
            console.log('📞 Got media stream with', stream.getTracks().length, 'tracks');
            return stream;
        } catch (error) {
            console.warn('⚠️ Could not get media:', error.message);

            // CRITICAL: ALERT USER ON MOBILE
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                alert("❌ Camera/Mic blocked! \n\nIf you are on mobile, Browser blocks camera on HTTP.\n\nType this in Chrome address bar:\nchrome://flags/#unsafely-treat-insecure-origin-as-secure\n\nEnable it and add: http://localhost:3000");
            } else if (error.name === 'NotFoundError') {
                alert("❌ No camera/mic found!");
            }

            // Try audio only if video failed
            if (type === 'video') {
                try {
                    const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                    localStreamRef.current = audioStream;
                    setLocalStream(audioStream);
                    console.log('📞 Got audio-only stream');
                    return audioStream;
                } catch (audioError) {
                    console.error('❌ Could not get audio:', audioError.message);
                    alert("❌ Audio also blocked. Cannot make call.");
                }
            }
            return null;
        }
    };

    // Create and setup peer connection
    const setupPeerConnection = useCallback((targetUserId) => {
        console.log('📞 Setting up peer connection for:', targetUserId);

        // Close existing connection if any
        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnectionRef.current = pc;

        // Add local tracks
        if (localStreamRef.current) {
            console.log('📞 Adding', localStreamRef.current.getTracks().length, 'local tracks');
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current);
            });
        }

        // ICE candidate handler
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('📞 Sending ICE candidate');
                socket.emit('call:ice-candidate', {
                    callId: callIdRef.current,
                    from: currentUser.userId,
                    to: targetUserId,
                    candidate: event.candidate
                });
            }
        };

        // Remote track handler
        pc.ontrack = (event) => {
            console.log('📹 Received remote track:', event.track.kind);
            if (event.streams && event.streams[0]) {
                remoteStreamRef.current = event.streams[0];
                setRemoteStream(event.streams[0]);
                console.log('📹 Remote stream set with', event.streams[0].getTracks().length, 'tracks');
            }
        };

        // Connection state handler
        // pc.onconnectionstatechange = () => {
        //     console.log('📞 Connection state:', pc.connectionState);
        // };

        pc.onconnectionstatechange = () => {
            console.log('📞 Connection state:', pc.connectionState);
            if (pc.connectionState === 'connected') {
                setCallState('connected');
            } else if (pc.connectionState === 'disconnected') {
                // keep UI, maybe show reconnecting UI
                setCallState(prev => prev === 'connected' ? 'connected' : prev);
            } else if (pc.connectionState === 'failed') {
                endCall('network_failed');
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log('📞 ICE connection state:', pc.iceConnectionState);
            if (pc.iceConnectionState === 'failed') {
                endCall('ice_failed');
            }
        };

        // pc.oniceconnectionstatechange = () => {
        //     console.log('📞 ICE connection state:', pc.iceConnectionState);
        // };

        // Add any pending ICE candidates
        if (pendingCandidatesRef.current.length > 0) {
            console.log('📞 Adding', pendingCandidatesRef.current.length, 'pending ICE candidates');
            pendingCandidatesRef.current.forEach(candidate => {
                pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
            });
            pendingCandidatesRef.current = [];
        }

        return pc;
    }, [currentUser]);

    // Start outgoing call (CALLER)
    const startCall = async (targetUser, type) => {
        console.log('📞 ===== START CALL =====');
        console.log('📞 Target:', targetUser?.username || targetUser?._id);
        console.log('📞 Type:', type);

        try {
            const newCallId = generateCallId();
            setCallId(newCallId);
            callIdRef.current = newCallId;
            setCallType(type);
            setRemoteUser(targetUser);
            remoteUserRef.current = targetUser;
            setCallState('calling');
            setCallDuration(0);

            // Get media first
            await getMediaStream(type);

            // Emit call invite
            socket.emit('call:invite', {
                callId: newCallId,
                from: currentUser.userId,
                to: targetUser._id,
                callType: type
            });
            console.log('📞 Call invite sent');

        } catch (error) {
            console.error('❌ Error starting call:', error);
            setCallState('idle');
            cleanup();
        }
    };

    // Answer incoming call (CALLEE)
    const answerCall = async () => {
        console.log('📞 ===== ANSWER CALL =====');

        try {
            // Get media first
            await getMediaStream(callType);

            // Setup peer connection with local tracks
            setupPeerConnection(getRemoteUserId(remoteUserRef.current));

            // Change state to connected
            setCallState('connected');

            // Send accept - this tells caller to send offer
            socket.emit('call:accept', {
                callId: callIdRef.current,
                from: currentUser.userId,
                to: getRemoteUserId(remoteUserRef.current)
            });
            console.log('📞 Call accept sent');

            // Start duration timer
            durationIntervalRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);

        } catch (error) {
            console.error('❌ Error answering call:', error);
        }
    };

    // Reject call
    const rejectCall = () => {
        socket.emit('call:reject', {
            callId: callIdRef.current,
            from: currentUser.userId,
            to: getRemoteUserId(remoteUserRef.current),
            reason: 'user_rejected'
        });
        setCallState('idle');
        cleanup();
    };

    // End call
    const endCall = useCallback((reason = 'user_hangup') => {
        if (callIdRef.current && remoteUserRef.current) {
            socket.emit('call:end', {
                callId: callIdRef.current,
                from: currentUser.userId,
                to: getRemoteUserId(remoteUserRef.current),
                reason
            });
        }

        setCallState('ended');
        setCallEndReason(reason);
        cleanup();

        setTimeout(() => {
            setCallState('idle');
            setCallId(null);
            setRemoteUser(null);
            setCallEndReason(null);
        }, 2000);
    }, [currentUser, cleanup]);

    // Toggle mute
    const toggleMute = () => {
        if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                setIsMuted(!audioTrack.enabled);
            }
        }
    };

    // Toggle video
    const toggleVideo = () => {
        if (localStreamRef.current) {
            const videoTrack = localStreamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                setIsVideoOff(!videoTrack.enabled);
            }
        }
    };

    // Socket event listeners
    useEffect(() => {
        if (!currentUser) return;

        // Incoming call (CALLEE receives this)
        socket.on('call:incoming', (data) => {
            console.log('📞 ===== INCOMING CALL =====');
            console.log('📞 From:', data.from);
            console.log('📞 Type:', data.callType);

            setCallId(data.callId);
            callIdRef.current = data.callId;
            setCallType(data.callType);
            setRemoteUser(data.from);
            remoteUserRef.current = data.from;
            setCallState('incoming');
        });

        // Call ringing (CALLER receives this)
        socket.on('call:ringing', () => {
            console.log('📞 Call is ringing');
            setCallState('ringing');
        });

        // Call accepted (CALLER receives this - now create offer)
        socket.on('call:accepted', async (data) => {
            console.log('📞 ===== CALL ACCEPTED =====');
            setCallState('connected');

            // Setup peer connection with local tracks
            const pc = setupPeerConnection(getRemoteUserId(remoteUserRef.current));

            // Create and send offer
            try {
                console.log('📞 Creating offer...');
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                console.log('📞 Sending offer');

                socket.emit('call:sdp', {
                    callId: callIdRef.current,
                    from: currentUser.userId,
                    to: getRemoteUserId(remoteUserRef.current),
                    sdp: offer,
                    type: 'offer'
                });

                // Start duration timer
                durationIntervalRef.current = setInterval(() => {
                    setCallDuration(prev => prev + 1);
                }, 1000);
            } catch (error) {
                console.error('❌ Error creating offer:', error);
            }
        });

        // SDP exchange (both sides)
        socket.on('call:sdp', async (data) => {
            console.log('📞 ===== RECEIVED SDP:', data.type, '=====');

            let pc = peerConnectionRef.current;

            // If no peer connection exists, create one (shouldn't happen normally)
            if (!pc) {
                console.log('📞 No peer connection, creating...');
                pc = setupPeerConnection(data.from);
            }

            try {
                if (data.type === 'offer') {
                    // CALLEE receives offer
                    console.log('📞 Setting remote description (offer)');
                    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

                    // FLUSH CANDIDATES NOW
                    if (pendingCandidatesRef.current.length > 0) {
                        console.log('📞 Flushing', pendingCandidatesRef.current.length, 'candidates after offer');
                        pendingCandidatesRef.current.forEach(candidate => {
                            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
                        });
                        pendingCandidatesRef.current = [];
                    }

                    // Make sure we have tracks added
                    // if (localStreamRef.current && pc.getSenders().length === 0) {
                    //     console.log('📞 Adding local tracks before answer');
                    //     localStreamRef.current.getTracks().forEach(track => {
                    //         pc.addTrack(track, localStreamRef.current);
                    //     });
                    // }

                    if (localStreamRef.current) {
                        localStreamRef.current.getTracks().forEach(track => {
                            const alreadyAdded = pc.getSenders().some(
                                sender => sender.track && sender.track.kind === track.kind
                            );
                            if (!alreadyAdded) {
                                pc.addTrack(track, localStreamRef.current);
                            }
                        });
                    }


                    console.log('📞 Creating answer');
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);

                    console.log('📞 Sending answer');
                    socket.emit('call:sdp', {
                        callId: callIdRef.current,
                        from: currentUser.userId,
                        to: data.from,
                        sdp: answer,
                        type: 'answer'
                    });
                } else if (data.type === 'answer') {
                    // CALLER receives answer
                    console.log('📞 Setting remote description (answer)');
                    await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));

                    // FLUSH CANDIDATES NOW
                    if (pendingCandidatesRef.current.length > 0) {
                        console.log('📞 Flushing', pendingCandidatesRef.current.length, 'candidates after answer');
                        pendingCandidatesRef.current.forEach(candidate => {
                            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(console.error);
                        });
                        pendingCandidatesRef.current = [];
                    }
                }
            } catch (error) {
                console.error('❌ Error handling SDP:', error);
            }
        });

        // ICE candidate exchange
        socket.on('call:ice-candidate', async (data) => {
            console.log('📞 Received ICE candidate');

            const pc = peerConnectionRef.current;
            if (pc && pc.remoteDescription) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (e) {
                    console.error('❌ Error adding ICE candidate:', e);
                }
            } else {
                // Queue the candidate for later
                console.log('📞 Queuing ICE candidate (no remote description yet)');
                pendingCandidatesRef.current.push(data.candidate);
            }
        });

        // Call rejected
        socket.on('call:rejected', () => {
            console.log('📞 Call rejected');
            setCallState('ended');
            setCallEndReason('rejected');
            cleanup();
            setTimeout(() => {
                setCallState('idle');
                setCallId(null);
                setRemoteUser(null);
            }, 2000);
        });

        // Call ended
        socket.on('call:ended', (data) => {
            console.log('📞 Call ended:', data.reason);
            setCallState('ended');
            setCallEndReason(data.reason);
            cleanup();
            setTimeout(() => {
                setCallState('idle');
                setCallId(null);
                setRemoteUser(null);
            }, 2000);
        });

        // Call timeout
        socket.on('call:timeout', () => {
            console.log('📞 Call timeout');
            setCallState('ended');
            setCallEndReason('no_answer');
            cleanup();
            setTimeout(() => {
                setCallState('idle');
                setCallId(null);
                setRemoteUser(null);
            }, 2000);
        });

        // User unavailable
        socket.on('call:unavailable', () => {
            console.log('📞 User unavailable');
            setCallState('ended');
            setCallEndReason('unavailable');
            cleanup();
            setTimeout(() => {
                setCallState('idle');
                setCallId(null);
                setRemoteUser(null);
            }, 2000);
        });

        return () => {
            socket.off('call:incoming');
            socket.off('call:ringing');
            socket.off('call:accepted');
            socket.off('call:rejected');
            socket.off('call:ended');
            socket.off('call:timeout');
            socket.off('call:unavailable');
            socket.off('call:sdp');
            socket.off('call:ice-candidate');
        };
    }, [currentUser, setupPeerConnection, cleanup]);

    const value = {
        callState,
        callType,
        callId,
        remoteUser,
        callDuration,
        isMuted,
        isVideoOff,
        callEndReason,
        localStream,
        remoteStream,
        startCall,
        answerCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo
    };

    return (
        <CallContext.Provider value={value}>
            {children}
        </CallContext.Provider>
    );
};

export const useCall = () => {
    const context = useContext(CallContext);
    if (!context) {
        throw new Error('useCall must be used within a CallProvider');
    }
    return context;
};

export default CallContext;
