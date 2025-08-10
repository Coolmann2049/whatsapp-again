document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let conversationsState = { list: [], currentPage: 1, totalPages: 1, isLoading: false, searchQuery: '' };
    let messagesState = { list: [], currentPage: 1, totalPages: 1, isLoading: false, activeContactId: null };

    // --- DOM REFERENCES ---
    const chatListContainer = document.getElementById('chat-list-container');
    const searchInput = document.getElementById('search-input');
    const welcomeMessage = document.getElementById('welcome-message');
    const chatViewContainer = document.getElementById('chat-view-container');
    const chatHeaderName = document.getElementById('chat-header-name');
    const messagesContainer = document.getElementById('messages-container');
    const messageInput = document.getElementById('message-input');
    const sendButton = document.getElementById('send-btn');
    const manualModeBtn = document.getElementById('manual-mode-toggle-btn');

    // --- UTILITY FUNCTIONS ---
    const debounce = (func, delay) => {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    };

    // --- RENDER FUNCTIONS ---
    const renderConversations = (append = false) => {
        if (!append) chatListContainer.innerHTML = '';
        
        if (conversationsState.list.length === 0 && !conversationsState.isLoading) {
            chatListContainer.innerHTML = `<p class="text-center text-muted p-4">No conversations found.</p>`;
            return;
        }

        conversationsState.list.forEach(convo => {
            const contact = convo.Contact || convo; // Handle the structure from the API
            const activeClass = messagesState.activeContactId === contact.id ? 'active' : '';
            const manualIcon = contact.is_manual_mode ? '<i class="bi bi-person-fill text-danger me-2" title="Manual Mode"></i>' : '';
            const chatItemHtml = `
                <a href="#" class="list-group-item list-group-item-action ${activeClass}" data-contact-id="${contact.id}">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${manualIcon}${contact.name}</h6>
                        <small class="text-muted">${new Date(convo.lastMessageAt).toLocaleTimeString()}</small>
                    </div>
                    <p class="mb-1 text-truncate small">${contact.phone}</p>
                </a>
            `;
            chatListContainer.insertAdjacentHTML('beforeend', chatItemHtml);
        });
    };

    const renderMessages = (prepend = false) => {
        if (!prepend) messagesContainer.innerHTML = '';
        
        // Messages are fetched newest first, so we reverse for chronological display
        messagesState.list.slice().reverse().forEach(msg => {
            const messageSide = msg.sender === 'bot' ? 'user-message' : 'bot-message';
            const messageHtml = `
                <div class="message-container ${messageSide}">
                    <div class="message-bubble">
                        <div>${msg.message_content}</div>
                        <span class="timestamp">${new Date(msg.timestamp).toLocaleString()}</span>
                    </div>
                </div>
            `;
            // Prepend to add older messages to the top
            messagesContainer.insertAdjacentHTML('afterbegin', messageHtml);
        });
    };

    const updateManualModeButton = (isManual) => {
        manualModeBtn.disabled = false;
        if (isManual) {
            manualModeBtn.innerHTML = `<i class="bi bi-person-fill me-1"></i> Manual Mode Active`;
            manualModeBtn.className = 'btn btn-sm btn-danger';
            messageInput.disabled = false;
            sendButton.disabled = false;
        } else {
            manualModeBtn.innerHTML = `<i class="bi bi-robot me-1"></i> AI Enabled`;
            manualModeBtn.className = 'btn btn-sm btn-primary';
            messageInput.disabled = true;
            sendButton.disabled = true;
        }
    };

    // --- API & DATA HANDLING ---
    const fetchConversations = async (page = 1, search = '', append = false) => {
        if (conversationsState.isLoading) return;
        conversationsState.isLoading = true;
        if (!append) conversationsState.list = [];

        try {
            const response = await fetch(`/api/chat/conversations?page=${page}&limit=30&search=${search}`);
            if (!response.ok) throw new Error('Failed to fetch conversations');
            const data = await response.json();

            conversationsState.list = append ? [...conversationsState.list, ...data.conversations] : data.conversations;
            conversationsState.currentPage = data.currentPage;
            conversationsState.totalPages = data.totalPages;
            renderConversations();
        } catch (error) {
            console.error(error);
        } finally {
            conversationsState.isLoading = false;
        }
    };

    const fetchMessages = async (contactId, page = 1) => {
        if (messagesState.isLoading) return;
        messagesState.isLoading = true;
        
        // Show loading spinner in message view
        if (page === 1) messagesContainer.innerHTML = `<div class="spinner-container"><div class="spinner-border text-primary"></div></div>`;

        try {
            const response = await fetch(`/api/chat/chat-history/${contactId}?page=${page}&limit=50`);
            if (!response.ok) throw new Error('Failed to fetch messages');
            const data = await response.json();

            messagesState.list = page === 1 ? data.messages : [...messagesState.list, ...data.messages];
            messagesState.currentPage = data.currentPage;
            messagesState.totalPages = data.totalPages;
            
            if (page === 1) {
                messagesContainer.innerHTML = ''; // Clear spinner
                renderMessages();
                messagesContainer.scrollTop = messagesContainer.scrollHeight; // Scroll to bottom on first load
            } else {
                const oldScrollHeight = messagesContainer.scrollHeight;
                renderMessages(true); // Prepend older messages
                messagesContainer.scrollTop = messagesContainer.scrollHeight - oldScrollHeight; // Maintain scroll position
            }

            updateManualModeButton(data.is_manual_mode);
        } catch (error) {
            console.error(error);
        } finally {
            messagesState.isLoading = false;
        }
    };
    
    const toggleManualMode = async () => {
        if (!messagesState.activeContactId) return;
        manualModeBtn.disabled = true;
        try {
            const response = await fetch(`/api/chat/conversations/${messagesState.activeContactId}/toggle-manual`, { method: 'PUT' });
            if (!response.ok) throw new Error('Failed to toggle mode');
            const data = await response.json();
            updateManualModeButton(data.is_manual_mode);
        } catch (error) {
            console.error(error);
            alert('Could not change mode. Please try again.');
        }
    };

    // --- EVENT HANDLERS ---
    const handleSearch = debounce(() => {
        conversationsState.searchQuery = searchInput.value;
        fetchConversations(1, conversationsState.searchQuery);
    }, 300);

    const handleConversationClick = (e) => {
        e.preventDefault();
        const chatItem = e.target.closest('.list-group-item');
        if (!chatItem || messagesState.isLoading) return;

        const contactId = parseInt(chatItem.dataset.contactId);
        if (messagesState.activeContactId === contactId) return;

        messagesState = { list: [], currentPage: 1, totalPages: 1, isLoading: false, activeContactId: contactId };
        
        // Update UI to show selection
        document.querySelectorAll('#chat-list-container .list-group-item').forEach(el => el.classList.remove('active'));
        chatItem.classList.add('active');
        
        welcomeMessage.classList.add('d-none');
        chatViewContainer.classList.remove('d-none');
        chatHeaderName.textContent = chatItem.querySelector('h6').textContent;
        
        fetchMessages(contactId, 1);
    };

    chatListContainer.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = chatListContainer;
        if (scrollTop + clientHeight >= scrollHeight - 5 && !conversationsState.isLoading && conversationsState.currentPage < conversationsState.totalPages) {
            fetchConversations(conversationsState.currentPage + 1, conversationsState.searchQuery, true);
        }
    });

    messagesContainer.addEventListener('scroll', () => {
        if (messagesContainer.scrollTop === 0 && !messagesState.isLoading && messagesState.currentPage < messagesState.totalPages) {
            fetchMessages(messagesState.activeContactId, messagesState.currentPage + 1);
        }
    });

    // --- ATTACH EVENT LISTENERS ---
    searchInput.addEventListener('input', handleSearch);
    chatListContainer.addEventListener('click', handleConversationClick);
    manualModeBtn.addEventListener('click', toggleManualMode);
    
    // TODO: Implement manual message sending
    // sendButton.addEventListener('click', ...);

    // --- INITIALIZATION ---
    fetchConversations();
});