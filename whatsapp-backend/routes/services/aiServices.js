// services/aiService.js

/**
 * Generates a response from the DeepSeek AI based on the user's configuration and chat context.
 *
 * @param {object} aiConfig - The user's saved AI configuration from the database.
 * @param {Array<object>} chatHistory - The history of the conversation.
 * @param {string} newMessage - The new message from the user.
 * @returns {Promise<string>} - The generated AI response.
 */
async function generateAiResponse(aiConfig, chatHistory, newMessage) {
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
        throw new Error('DeepSeek API key is not configured on the server.');
    }

    // --- Step 1: Build the detailed prompt for the AI ---
    // This is the placeholder prompt you will design. It combines all the context.
    const systemPrompt = `
        You are an expert AI assistant for a business. Here is your context:
        - Business Name: ${aiConfig.business_name}
        - Industry: ${aiConfig.industry}
        - Description: ${aiConfig.business_description}
        - Key Products/Services: ${aiConfig.key_products}
        - Your communication tone must be: ${aiConfig.communication_tone}.

        Your personality should be adjusted based on these levels (0-100):
        - Formality: ${aiConfig.personality.formality}
        - Friendliness: ${aiConfig.personality.friendliness}
        - Creativity: ${aiConfig.personality.creativity}
        - Detail: ${aiConfig.personality.detail}

        Here are some frequently asked questions and their answers you should use:
        ${JSON.stringify(aiConfig.faq, null, 2)}

        Here are instructions on what you MUST NOT do:
        ${aiConfig.not_to_do_instructions}

        You are now in a conversation. Respond to the latest message from the user based on all of this context and the chat history provided.
    `;

    // Format the conversation for the API
    const messages = [
        {
            role: "system",
            content: systemPrompt
        },
        // You could add the chatHistory here if needed, for example:
         ...chatHistory.map(msg => ({ role: msg.sender === 'bot' ? 'assistant' : 'user', content: msg.message_content })),
        {
            role: "user",
            content: newMessage
        }
    ];

    try {
        // --- Step 2: Make the API call to the DeepSeek API ---
        const response = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "deepseek-chat", // Or "deepseek-coder" if you prefer
                messages: messages,
                stream: false // We want a single, complete response
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`DeepSeek API error: ${response.status} ${errorBody}`);
        }

        const result = await response.json();

        // --- Step 3: Extract and return the generated text ---
        if (result.choices && result.choices.length > 0) {
            return result.choices[0].message.content;
        } else {
            throw new Error('Received an invalid response from the AI.');
        }

    } catch (error) {
        console.error("Error calling DeepSeek API:", error);
        // Provide a fallback error message to the user
        return "I'm sorry, but I'm having trouble connecting to my brain right now. Please try again in a moment.";
    }
}

module.exports = { generateAiResponse };