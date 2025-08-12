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

    // --- RENDER FUNCTIONS ---
    function renderFAQs() {
        // ... (this function remains the same) ...
    }

    function addChatMessage(message, sender) {
        // ... (this function remains the same) ...
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
        // ... (this function remains the same) ...
    }

    // --- EVENT HANDLERS ---
    function handleAddFAQ() {
        // ... (this function remains the same) ...
    }

    function handleDeleteFAQ(e) {
        // ... (this function remains the same) ...
    }

    async function handleChatSend() {
        // ... (this function remains the same) ...
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