// src/components/CallModal.js
import React, { useRef, useEffect } from 'react';
import { useCall } from '../contexts/CallContext';
import './CallModal.css';

const CallModal = () => {
    const {
        callState,
        callType,
        remoteUser,
        callDuration,
        callEndReason,
        localStream,
        remoteStream,
        isMuted,
        isVideoOff,
        answerCall,
        rejectCall,
        endCall,
        toggleMute,
        toggleVideo
    } = useCall();

    // Video refs
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    // Check if streams have video tracks
    const hasLocalVideo = localStream && localStream.getVideoTracks().length > 0;
    const hasRemoteVideo = remoteStream && remoteStream.getVideoTracks().length > 0;

    // Set video srcObject using useEffect
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            console.log('📹 Setting local video, has video tracks:', hasLocalVideo);
            localVideoRef.current.srcObject = localStream;
        }
    }, [localStream, hasLocalVideo]);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            console.log('📹 Setting remote video, has video tracks:', hasRemoteVideo);
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream, hasRemoteVideo]);

    // Format duration
    const formatDuration = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Get status text
    const getStatusText = () => {
        switch (callState) {
            case 'calling': return 'Calling...';
            case 'ringing': return 'Ringing...';
            case 'incoming': return 'Incoming call';
            case 'connected': return formatDuration(callDuration);
            case 'ended':
                switch (callEndReason) {
                    case 'rejected': return 'Call declined';
                    case 'no_answer': return 'No answer';
                    case 'unavailable': return 'User unavailable';
                    case 'user_hangup': return 'Call ended';
                    case 'cancelled': return 'Call cancelled';
                    default: return 'Call ended';
                }
            default: return '';
        }
    };

    // Get username from remoteUser
    const getUsername = () => {
        if (!remoteUser) return 'Unknown';
        if (typeof remoteUser === 'object' && remoteUser.username) {
            return remoteUser.username;
        }
        if (typeof remoteUser === 'string') {
            return remoteUser.length > 10 ? `User ${remoteUser.slice(-6)}` : remoteUser;
        }
        return 'Unknown';
    };

    // Check if we should show video mode
    const isVideoCall = callType === 'video';
    const isConnected = callState === 'connected';
    const showVideoMode = isVideoCall && isConnected;

    // Helper to force play video
    const forcePlay = (ref, name) => {
        if (ref.current) {
            ref.current.play()
                .then(() => console.log(`✅ ${name} video playing`))
                .catch(err => console.warn(`❌ ${name} play blocked:`, err.message));
        }
    };

    // Modified answer call to unlock audio context
    const handleAnswerCall = async () => {
        // Unlock playback on user interaction
        if (remoteVideoRef.current) {
            remoteVideoRef.current.play().catch(() => { });
        }
        await answerCall();

        // Force play again just in case
        setTimeout(() => {
            forcePlay(remoteVideoRef, 'remote');
        }, 1000);
    };

    // Video ready handlers
    const onLocalLoaded = () => forcePlay(localVideoRef, 'local');
    const onRemoteLoaded = () => forcePlay(remoteVideoRef, 'remote');

    // Check tracks for debugging
    useEffect(() => {
        if (localStream) {
            localStream.getAudioTracks().forEach(track => {
                console.log("🎤 Local Audio enabled:", track.enabled, "muted:", track.muted);
            });
        }
        if (remoteStream) {
            remoteStream.getAudioTracks().forEach(track => {
                console.log("🎤 Remote Audio enabled:", track.enabled, "muted:", track.muted);
            });
        }
    }, [localStream, remoteStream]);

    // Don't render if idle
    if (callState === 'idle') return null;

    return (
        <div className="call-modal-overlay">
            <div className={`call-modal ${showVideoMode ? 'video-mode' : ''}`}>

                {/* 
                  ALWAYS render the remote video element, even if hidden.
                  This is CRITICAL for audio playback in all call types.
                */}
                <video
                    className="remote-video"
                    autoPlay
                    playsInline
                    ref={remoteVideoRef}
                    onLoadedMetadata={onRemoteLoaded}
                    style={{
                        display: showVideoMode && hasRemoteVideo ? 'block' : 'none',
                        position: 'absolute', // Ensure it doesn't affect layout when hidden
                        width: '1px',
                        height: '1px',
                        opacity: showVideoMode && hasRemoteVideo ? 1 : 0
                    }}
                />

                {/* 
                  ALWAYS render local video element too, hidden if not needed.
                  This ensures local stream is kept active.
                */}
                <video
                    className="local-video"
                    autoPlay
                    playsInline
                    muted
                    ref={localVideoRef}
                    onLoadedMetadata={onLocalLoaded}
                    style={{
                        display: showVideoMode && hasLocalVideo ? 'block' : 'none',
                    }}
                />

                {/* Video container - visual part only */}
                {showVideoMode && (
                    <div className="video-container">
                    </div>
                )}

                {/* 
                   BETTER APPROACH:
                   Keep the `video-container` div conditionally rendered for LAYOUT,
                   but keep the `<video>` elements OUTSIDE it (hidden) when not in video mode?
                   OR better: Always render `video-container` but execute different CSS classes?
                */}

                {/* Video container - rendered if we are in video mode OR if we need to play audio */}
                {/* Actually, let's just make the video elements hidden but present at top level */}

                {/* HIDDEN MEDIA ELEMENTS FOR AUDIO PLAYBACK */}
                <div style={{ position: 'absolute', top: '-9999px', visibility: 'hidden' }}>
                    {/* We only need this if we don't display them visibly below.
                        But React refs can't be shared. 
                        So we must render the video elements visibly when needed, and hidden when not.
                        We can't mount/unmount them without losing the stream connection potentially.
                    */}
                </div>

                {/* 
                    CORRECT APPROACH:
                    Always render the visual structure, but change classes/styles based on mode.
                 */}

                <div className={`video-container ${showVideoMode ? 'visible' : 'hidden'}`} style={{ display: showVideoMode ? 'block' : 'none' }}>
                    {/* Remote Video - visible reference */}

                </div>

                {/* 
                    Wait, if I use `display: none` on the container, the children are not rendered? 
                    No, they are in DOM but hidden. `display: none` elements DO NOT play video usually in some browsers optimization?
                    Safest is `visibility: hidden` or `opacity: 0` for audio playback.
                 */}

                {/* 
                    Let's try this:
                    Always render a container for media.
                    If showVideoMode is true, it covers screen.
                    If false, it is hidden but media plays.
                 */}

                <div className="media-container" style={{
                    position: 'absolute',
                    top: 0, left: 0, width: '100%', height: '100%',
                    zIndex: 0,
                    visibility: showVideoMode ? 'visible' : 'hidden', // Hides visuals but keeps easy media access?
                    // Actually visibility:hidden might stop rendering updates but audio should play.
                }}>
                    {/* Remote Video */}
                    <video
                        className="remote-video"
                        autoPlay
                        playsInline
                        ref={remoteVideoRef}
                        onLoadedMetadata={onRemoteLoaded}
                        style={{
                            display: hasRemoteVideo ? 'block' : 'none',
                            // If we are in audio mode, we still need this element for audio track!
                            // So if !showVideoMode, we still render it.
                            // But hasRemoteVideo checks for VIDEO tracks.
                            // If remoteStream exists but no video tracks (audio), hasRemoteVideo is false.
                            // We MUST render video element if remoteStream exists, regardless of tracks.
                        }}
                    />

                    {/* If we have remote stream but no video tracks, we typically use the same video element or an audio element.
                        Video element works for audio-only streams too.
                    */}
                    {!hasRemoteVideo && remoteStream && (
                        // We need the element to exist for audio to play. 
                        // If hasRemoteVideo is false, the above video tag is display:none.
                        // Does display:none prevent audio? In some browsers YES.
                        // Let's force it to be technically active.
                        <audio
                            autoPlay
                            ref={(el) => {
                                if (el && remoteStream) {
                                    el.srcObject = remoteStream;
                                    el.play().catch(e => console.error("Audio play error", e));
                                }
                            }}
                        />
                    )}

                    {/* Local Video */}
                    <video
                        className="local-video"
                        autoPlay
                        playsInline
                        muted
                        ref={localVideoRef}
                        onLoadedMetadata={onLocalLoaded}
                        style={{ display: hasLocalVideo ? 'block' : 'none' }}
                    />
                </div>

                {/* Placeholders for video mode */}
                {showVideoMode && !hasRemoteVideo && (
                    <div className="video-container">
                        <div className="remote-video-placeholder">
                            <div className="placeholder-avatar">
                                {getUsername()[0]?.toUpperCase() || '?'}
                            </div>
                            <p>{remoteStream ? 'Audio only' : 'Connecting video...'}</p>
                        </div>
                    </div>
                )}

                {showVideoMode && !hasLocalVideo && (
                    <div className="local-video no-camera" style={{ position: 'absolute', bottom: '100px', right: '20px', zIndex: 10 }}>
                        <span className="material-icons">
                            {localStream ? 'mic' : 'videocam_off'}
                        </span>
                        <span className="no-camera-text">
                            {localStream ? 'Audio only' : 'No camera'}
                        </span>
                    </div>
                )}

                {/* Call info */}
                <div className="call-info">
                    <div className="call-avatar">
                        <span>{getUsername()[0]?.toUpperCase() || '?'}</span>
                    </div>
                    <h3 className="call-username">{getUsername()}</h3>
                    <p className="call-status">{getStatusText()}</p>
                    <p className="call-type">
                        <span className="material-icons">
                            {callType === 'video' ? 'videocam' : 'call'}
                        </span>
                        {callType === 'video' ? 'Video Call' : 'Voice Call'}
                    </p>

                    {/* Stream info for debugging */}
                    {isConnected && isVideoCall && (
                        <p className="stream-info">
                            {hasLocalVideo ? '📹 Your video on' : '🔇 Your video off'} |
                            {hasRemoteVideo ? ' 📹 Their video on' : ' 🔇 Their video off'}
                        </p>
                    )}
                </div>

                {/* Call actions */}
                <div className="call-actions">
                    {/* Incoming call actions */}
                    {callState === 'incoming' && (
                        <>
                            <button className="call-btn reject" onClick={rejectCall}>
                                <span className="material-icons">call_end</span>
                            </button>
                            <button className="call-btn accept" onClick={handleAnswerCall}>
                                <span className="material-icons">call</span>
                            </button>
                        </>
                    )}

                    {/* Calling/Ringing actions */}
                    {(callState === 'calling' || callState === 'ringing') && (
                        <button className="call-btn reject" onClick={() => endCall('cancelled')}>
                            <span className="material-icons">call_end</span>
                        </button>
                    )}

                    {/* Connected call actions */}
                    {callState === 'connected' && (
                        <>
                            <button
                                className={`call-btn control ${isMuted ? 'active' : ''}`}
                                onClick={toggleMute}
                                title={isMuted ? 'Unmute' : 'Mute'}
                            >
                                <span className="material-icons">
                                    {isMuted ? 'mic_off' : 'mic'}
                                </span>
                            </button>

                            {callType === 'video' && (
                                <button
                                    className={`call-btn control ${isVideoOff ? 'active' : ''}`}
                                    onClick={toggleVideo}
                                    title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}
                                >
                                    <span className="material-icons">
                                        {isVideoOff ? 'videocam_off' : 'videocam'}
                                    </span>
                                </button>
                            )}

                            <button className="call-btn reject" onClick={() => endCall()}>
                                <span className="material-icons">call_end</span>
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CallModal;
