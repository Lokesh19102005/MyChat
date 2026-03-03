import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { authenticateMiddleware } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Handle general AI chat / tasks
 * POST /api/ai/chat
 */
router.post('/chat', authenticateMiddleware, async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "Prompt is required" });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "Gemini API Key is not configured on the server." });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        // System prompt context for general assistant
        const systemPrompt = "You are a helpful, concise AI assistant integrated into a chat application. You help users write emails, refine messages, or answer questions.";
        const fullPrompt = `${systemPrompt}\n\nUser: ${prompt}`;

        const result = await model.generateContent(fullPrompt);
        const response = await result.response;
        const text = response.text();

        res.json({ text });
    } catch (error) {
        console.error("Gemini API Error (Chat):", error);
        res.status(500).json({ error: "Failed to generate AI response. Please try again." });
    }
});

/**
 * Handle AI suggestions/refinements for chat
 * POST /api/ai/suggest
 */
router.post('/suggest', authenticateMiddleware, async (req, res) => {
    try {
        const { text, context } = req.body;

        if (!text && !context) {
            return res.status(400).json({ error: "Text or context is required for a suggestion." });
        }

        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ error: "Gemini API Key is not configured on the server." });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        let prompt = "";
        if (text && !context) {
            prompt = `Please refine or improve the following message to sound more professional and clear, keep it concise:\n"${text}"`;
        } else if (context && !text) {
            prompt = `Based on the following chat context, suggest a short, natural reply:\n"${context}"`;
        } else {
            prompt = `Given the chat context:\n"${context}"\n\nPlease refine this draft reply to sound better and fit the context:\n"${text}"`;
        }

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const suggestion = response.text();

        res.json({ suggestion: suggestion.trim() });
    } catch (error) {
        console.error("Gemini API Error (Suggest):", error);
        res.status(500).json({ error: "Failed to generate AI suggestion." });
    }
});

export default router;
