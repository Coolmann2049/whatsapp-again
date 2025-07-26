document.addEventListener('DOMContentLoaded', () => {
    // --- SAMPLE DATA & STATE ---
    const chats = [{
        id: 1,
        contact: 'John Doe',
        phone: '+1234567890',
        lastMessage: 'Thank you for your help!',
        timestamp: '10:30 AM',
        status: 'active',
        messages: [{
            id: 1, text: 'Hello! How can I help you today?', sender: 'bot', timestamp: '10:25 AM'
        }, {
            id: 2, text: 'I need information about your services', sender: 'user', timestamp: '10:27 AM'
        }, {
            id: 3, text: 'Thank you for your help!', sender: 'user', timestamp: '10:30 AM'
        }, ],
    }, {
        id: 2,
        contact: 'Jane Smith',
        phone: '+0987654321',
        lastMessage: 'Okay, sounds good.',
        timestamp: 'Yesterday',
        status: 'closed',
        messages: [{
            id: 1, text: 'Your appointment is confirmed.', sender: 'bot', timestamp: 'Yesterday'
        }, {
            id: 2, text: 'Okay, sounds good.', sender: 'user', timestamp: 'Yesterday'
        }]
    }, ];
    let selectedChat = null;
    let aiEnabled = true;

    // --- DOM REFERENCES ---
    const chatListContainer = document.getElementById('chat-list-container');
    const welcomeMessage = document.getElementById('welcome-message');
    const chatViewContainer = document.getElementById('chat-view-container');
    const chatHeaderName = document.getElementById('chat-header-name');
    const messagesContainer = document.getElementById('messages-container');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-btn');
    const aiToggleButton = document.getElementById('ai-toggle-btn');
    const searchInput = document.getElementById('search-input');

    // --- RENDER FUNCTIONS ---
    const renderChatList = (chatsToRender) => {
        chatListContainer.innerHTML = '';
        chatsToRender.forEach(chat => {
            const activeClass = selectedChat && selectedChat.id === chat.id ? 'active' : '';
            const statusColor = chat.status === 'active' ? 'success' : 'secondary';
            const chatItemHtml = `
                <a href="#" class="list-group-item list-group-item-action ${activeClass}" data-chat-id="${chat.id}">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${chat.contact}</h6>
                        <small>${chat.timestamp}</small>
                    </div>
                    <p class="mb-1 text-truncate">${chat.lastMessage}</p>
                    <small><span class="badge bg-${statusColor}">${chat.status}</span></small>
                </a>
            `;
            chatListContainer.insertAdjacentHTML('beforeend', chatItemHtml);
        });
    };

    const renderConversation = (chat) => {
        if (!chat) return;
        welcomeMessage.classList.add('d-none');
        chatViewContainer.classList.remove('d-none');
        chatHeaderName.textContent = chat.contact;
        messagesContainer.innerHTML = '';
        chat.messages.forEach(msg => {
            const messageSide = msg.sender === 'user' ? 'user-message' : 'contact-message';
            const messageHtml = `
                <div class="message-container ${messageSide}">
                    <div class="message-bubble">
                        <div>${msg.text}</div>
                        <span class="timestamp">${msg.timestamp}</span>
                    </div>
                </div>
            `;
            messagesContainer.insertAdjacentHTML('beforeend', messageHtml);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };

    // --- EVENT HANDLERS ---
    const selectChat = (e) => {
        e.preventDefault();
        const chatItem = e.target.closest('.list-group-item');
        if (!chatItem) return;

        const chatId = parseInt(chatItem.dataset.chatId);
        selectedChat = chats.find(c => c.id === chatId);
        renderChatList(chats.filter(c => c.contact.toLowerCase().includes(searchInput.value.toLowerCase())));
        renderConversation(selectedChat);
    };

    const sendMessage = () => {
        const text = messageInput.value.trim();
        if (!text || !selectedChat) return;

        const newMessage = {
            id: Date.now(),
            text: text,
            sender: 'user', // Assuming agent sends as user from this UI
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        selectedChat.messages.push(newMessage);
        renderConversation(selectedChat);
        messageInput.value = '';
        messageInput.focus();
    };

    const toggleAI = () => {
        aiEnabled = !aiEnabled;
        const icon = aiToggleButton.querySelector('i');
        const text = aiToggleButton.querySelector('span');

        aiToggleButton.classList.toggle('btn-primary', aiEnabled);
        aiToggleButton.classList.toggle('btn-outline-danger', !aiEnabled);
        icon.classList.toggle('bi-robot', aiEnabled);
        icon.classList.toggle('bi-person', !aiEnabled);
        text.textContent = aiEnabled ? 'AI Enabled' : 'Manual Mode';
    };
    
    const searchChats = (e) => {
        const query = e.target.value.toLowerCase();
        const filteredChats = chats.filter(c => c.contact.toLowerCase().includes(query) || c.phone.includes(query));
        renderChatList(filteredChats);
    };

    // --- ATTACH EVENT LISTENERS ---
    chatListContainer.addEventListener('click', selectChat);
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    aiToggleButton.addEventListener('click', toggleAI);
    searchInput.addEventListener('keyup', searchChats);
    
    // --- INITIAL RENDER ---
    renderChatList(chats);
});