document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let faqs = [];

    // --- DOM REFERENCES ---
    const saveButton = document.getElementById('save-config-btn');
    const saveAlert = document.getElementById('save-alert');
    
    // Form fields
    const businessNameInput = document.getElementById('businessName');
    const industryInput = document.getElementById('industry');
    const descriptionInput = document.getElementById('description');
    const keyProductsInput = document.getElementById('keyProducts');
    const tonePreferenceSelect = document.getElementById('tonePreference');
    const notToDoInput = document.getElementById('notToDo');
    const knowledgeBaseInput = document.getElementById('knowledgeBase');
    
    // Personality sliders & value displays
    const sliders = {
        formality: { input: document.getElementById('formality'), output: document.getElementById('formality-value') },
        friendliness: { input: document.getElementById('friendliness'), output: document.getElementById('friendliness-value') },
        creativity: { input: document.getElementById('creativity'), output: document.getElementById('creativity-value') },
        detail: { input: document.getElementById('detail'), output: document.getElementById('detail-value') }
    };

    // FAQ elements
    const faqQuestionInput = document.getElementById('faq-question');
    const faqAnswerInput = document.getElementById('faq-answer');
    const addFaqBtn = document.getElementById('add-faq-btn');
    const faqListContainer = document.getElementById('faq-list');

    // Chat test elements
    const chatInterface = document.getElementById('chat-interface');
    const chatPlaceholder = document.getElementById('chat-placeholder');
    const chatMessagesContainer = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat-btn');

    const formalitySlider = document.getElementById('formality');
    const friendlinessSlider = document.getElementById('friendliness');
    const creativitySlider = document.getElementById('creativity');
    const detailSlider = document.getElementById('detail');



    // --- RENDER FUNCTIONS ---
    function renderFAQs() {
        faqListContainer.innerHTML = '';
        if (faqs.length === 0) {
            faqListContainer.innerHTML = '<p class="text-muted small text-center">No FAQs added yet.</p>';
            return;
        }
        faqs.forEach((faq, index) => {
            const faqItem = `
                <div class="faq-item">
                    <p class="faq-question">${faq.question}</p>
                    <button class="btn btn-sm btn-outline-danger btn-delete-faq" data-index="${index}">&times;</button>
                </div>
            `;
            faqListContainer.insertAdjacentHTML('beforeend', faqItem);
        });
    }

    function addChatMessage(message, sender) {
        // Sanitize message to prevent XSS before inserting as HTML
        const sanitizedMessage = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        const messageClass = sender === 'user' ? 'user-message' : 'ai-message';
        let messageHtml;
        if (sender === 'ai') {
            messageHtml = `<div class="chat-bubble ${messageClass}">${message}</div>`;
        } else {
            messageHtml = `<div class="chat-bubble ${messageClass}">${sanitizedMessage}</div>`;
        }

        chatMessagesContainer.insertAdjacentHTML('beforeend', messageHtml);
        chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    }


    const updateSliderValue = (sliderName) => {
        if (sliders[sliderName]) {
            sliders[sliderName].output.textContent = sliders[sliderName].input.value;
        }
    };

    // --- API & DATA HANDLING ---
    async function loadConfig() {
        try {
            const response = await fetch('/api/data/ai-configuration');
            if (!response.ok) throw new Error('Failed to load configuration');
            const config = await response.json();
            
            if (config) {
                // Show the chat interface
                chatInterface.classList.remove('d-none');
                chatPlaceholder.classList.add('d-none');

                businessNameInput.value = config.business_name || '';
                industryInput.value = config.industry || '';
                descriptionInput.value = config.business_description || '';
                keyProductsInput.value = config.key_products || '';
                tonePreferenceSelect.value = config.communication_tone || 'professional';
                notToDoInput.value = config.not_to_do_instructions || '';
                knowledgeBaseInput.value = config.knowledgeBase || '';

                if (config.personality) {
                    sliders.formality.input.value = config.personality.formality || 50;
                    sliders.friendliness.input.value = config.personality.friendliness || 50;
                    sliders.creativity.input.value = config.personality.creativity || 50;
                    sliders.detail.input.value = config.personality.detail || 50;
                }
                // Update all slider value displays
                Object.keys(sliders).forEach(updateSliderValue);
                
                faqs = typeof config.faq === 'string' ? JSON.parse(config.faq) : (config.faq || []);
                renderFAQs();
            } else {
                // No config found, show the placeholder
                chatInterface.classList.add('d-none');
                chatPlaceholder.classList.remove('d-none');
                // Update all slider value displays to their default
                Object.keys(sliders).forEach(updateSliderValue);
            }
        } catch (error) {
            console.error('Error loading AI config:', error);
            alert('Could not load your saved AI configuration.');
        }
    }

    async function saveConfig() {
        if (!businessNameInput.value.trim() || !industryInput.value.trim() || !descriptionInput.value.trim()) {
            alert('Please fill out all required fields (*).');
            return;
        }

        const configData = {
            business_name: businessNameInput.value,
            industry: industryInput.value,
            business_description: descriptionInput.value,
            key_products: keyProductsInput.value,
            communication_tone: tonePreferenceSelect.value,
            not_to_do_instructions: notToDoInput.value,
            knowledgeBase: knowledgeBaseInput.value,
            personality: {
                formality: parseInt(formalitySlider.value),
                friendliness: parseInt(friendlinessSlider.value),
                creativity: parseInt(creativitySlider.value),
                detail: parseInt(detailSlider.value),
            },
            faq: faqs
        };

        saveButton.disabled = true;
        saveButton.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

        try {
            const response = await fetch('/api/data/ai-configuration', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(configData)
            });

            if (!response.ok) throw new Error('Failed to save configuration');
            
            saveAlert.classList.remove('d-none');
            setTimeout(() => saveAlert.classList.add('d-none'), 3000);

        } catch (error) {
            console.error('Error saving config:', error);
            alert('An error occurred while saving. Please try again.');
        } finally {
            saveButton.disabled = false;
            saveButton.innerHTML = '<i class="bi bi-save me-2"></i>Save Configuration';
        }
    }

    // --- EVENT HANDLERS ---
    function handleAddFAQ() {
        const question = faqQuestionInput.value.trim();
        const answer = faqAnswerInput.value.trim();
        if (question && answer) {
            faqs.push({ question, answer });
            renderFAQs();
            faqQuestionInput.value = '';
            faqAnswerInput.value = '';
        } else {
            alert('Please provide both a question and an answer.');
        }
    }

    function handleDeleteFAQ(e) {
        if (e.target.matches('.btn-delete-faq')) {
            const index = parseInt(e.target.dataset.index);
            faqs.splice(index, 1);
            renderFAQs();
        }
    }

    async function handleChatSend() {
        const userMessage = chatInput.value.trim();
        if (!userMessage) return;

        addChatMessage(userMessage, 'user');
        chatInput.value = '';
        chatInput.disabled = true;
        sendChatBtn.disabled = true;

        // Add typing indicator
        addChatMessage('<div class="typing-indicator"><span></span><span></span><span></span></div>', 'ai');

        try {
            // --- REAL API CALL ---
            const response = await fetch('/api/data/ai/test-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: userMessage })
            });

            const result = await response.json();
            
            if (!response.ok) {
                throw new Error(result.error || 'The AI failed to respond.');
            }

            // Display the real AI response
            addChatMessage(result.reply, 'ai');

        } catch (error) {
            console.error('Chat test error:', error);
            addChatMessage(`Error: ${error.message}`, 'ai');
        } finally {
            // Remove typing indicator and re-enable input
            const typingIndicator = chatMessagesContainer.querySelector('.typing-indicator');
            if (typingIndicator) typingIndicator.parentElement.remove();
            
            chatInput.disabled = false;
            sendChatBtn.disabled = false;
            chatInput.focus();
        }
    }

    // --- ATTACH EVENT LISTENERS ---
    saveButton.addEventListener('click', saveConfig);
    addFaqBtn.addEventListener('click', handleAddFAQ);
    faqListContainer.addEventListener('click', handleDeleteFAQ);
    sendChatBtn.addEventListener('click', handleChatSend);
    chatInput.addEventListener('keyup', (e) => { if (e.key === 'Enter') handleChatSend(); });

    // Add listeners for all sliders
    Object.keys(sliders).forEach(sliderName => {
        sliders[sliderName].input.addEventListener('input', () => updateSliderValue(sliderName));
    });

    // --- INITIALIZATION ---
    function init() {
        loadConfig();
        addChatMessage("Hello! I'm your AI assistant. Ask me anything to test my responses based on your configuration.", 'ai');
    }

    init();
});
