import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import './AIAssistant.css';
import { API_URL } from '../config';

const AIAssistant = ({ onClose }) => {
    const [messages, setMessages] = useState([
        { role: 'assistant', text: 'Hi! I am your AI assistant. I can help you draft emails, refine messages, or answer questions. What can I do for you today?' }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    // Auto focus input on load
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    const handleSend = async (messageText = input) => {
        if (!messageText.trim()) return;

        const userMsg = { role: 'user', text: messageText };
        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post(`${API_URL}/api/ai/chat`,
                { prompt: messageText },
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            setMessages((prev) => [
                ...prev,
                { role: 'assistant', text: response.data.text }
            ]);
        } catch (error) {
            console.error("AI Assistant Error:", error);
            setMessages((prev) => [
                ...prev,
                { role: 'error', text: 'Sorry, I encountered an error. Please try again.' }
            ]);
        } finally {
            setIsLoading(false);
            if (inputRef.current) {
                inputRef.current.focus();
            }
        }
    };

    const handleQuickAction = (action) => {
        handleSend(action);
    };

    const quickActions = [
        "Write a professional email",
        "Generate a polite decline message",
        "Summarize my thoughts into bullet points",
        "Suggest a casual greeting"
    ];

    return (
        <div className="ai-modal-overlay" onClick={onClose}>
            <div className="ai-modal" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="ai-header">
                    <h3>
                        <span className="material-icons">auto_awesome</span>
                        AI Assistant
                    </h3>
                    <button className="close-ai-btn" onClick={onClose}>
                        <span className="material-icons">close</span>
                    </button>
                </div>

                {/* Messages Area */}
                <div className="ai-messages">
                    {messages.map((msg, index) => (
                        <div key={index} className={`ai-message ${msg.role}`}>
                            {msg.role === 'assistant' ? (
                                <div className="ai-markdown-content">
                                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                                </div>
                            ) : (
                                <p>{msg.text}</p>
                            )}
                        </div>
                    ))}
                    {isLoading && (
                        <div className="typing-indicator">
                            <span className="typing-dot"></span>
                            <span className="typing-dot"></span>
                            <span className="typing-dot"></span>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Actions (only show if no user questions have been asked yet) */}
                {messages.length === 1 && (
                    <div className="ai-quick-actions">
                        {quickActions.map((action, i) => (
                            <button
                                key={i}
                                className="ai-quick-pill"
                                onClick={() => handleQuickAction(action)}
                            >
                                {action}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input Area */}
                <div className="ai-input-container">
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Ask the AI anything..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                        disabled={isLoading}
                    />
                    <button
                        className="ai-send-btn"
                        onClick={() => handleSend()}
                        disabled={isLoading || !input.trim()}
                    >
                        <span className="material-icons">send</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AIAssistant;
