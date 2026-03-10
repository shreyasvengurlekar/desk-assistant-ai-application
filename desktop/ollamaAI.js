async function askOllama(message) {
    try {
        const res = await fetch("http://localhost:11434/api/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "phi3",
                stream: false,
                messages: [
                    {
                        role: "system",
                        content:
                            "You are Desk Assistant AI, a specialized local file management assistant. " +
                            "Your ONLY output must be a single, valid JSON object. " +
                            "Do NOT include markdown, explanations, instructions, or any text outside the JSON. " +
                            "Format: {\"intent\": \"command_name\", \"message\": \"short user-friendly message\"} " +
                            "Allowed intents: organize_downloads, organize_desktop, organize_both, find_resume, find_duplicates, find_large_files, clean_desktop, none. " +
                            "If the user asks something unrelated to files, folders, storage, search, duplicates, rename, merge, open, or cleanup, " +
                            "respond with intent 'none' and the message: 'I'm here to help with files, folders, searches, duplicates, and organization on your computer. Please ask me something related to your files.'."
                    },
                    {
                        role: "user",
                        content: message
                    }
                ]
            })
        });

        const data = await res.json();

        if (!data.message || !data.message.content) {
            return JSON.stringify({ intent: "none", message: "I'm sorry, I couldn't process that request." });
        }

        // Clean raw content: remove everything except the JSON block
        let content = data.message.content.trim();
        
        // Find the first { and the last }
        const start = content.indexOf('{');
        const end = content.lastIndexOf('}');
        
        if (start !== -1 && end !== -1 && end > start) {
            const jsonPart = content.substring(start, end + 1);
            return jsonPart;
        }

        // Fallback if no valid JSON structure is found
        return JSON.stringify({ intent: "none", message: content });

    } catch (err) {
        console.error("Ollama error:", err);
        return JSON.stringify({ intent: "none", message: "AI connection failed. Please ensure Ollama is running." });
    }
}

module.exports = { askOllama };
