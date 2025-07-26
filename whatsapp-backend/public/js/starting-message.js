document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let messages = [{
        id: 1,
        text: 'Hello! Thank you for contacting Blulink. How can we assist you today?',
        isDefault: true,
    }, ];
    let editingMessage = null;

    // --- DOM ELEMENT REFERENCES ---
    const messageListContainer = document.getElementById('message-list-container');
    const messageModalElement = document.getElementById('messageModal');
    const messageModal = new bootstrap.Modal(messageModalElement);
    const messageModalLabel = document.getElementById('messageModalLabel');
    const messageTextarea = document.getElementById('message-text');

    // --- RENDER FUNCTION ---
    const renderMessages = () => {
        messageListContainer.innerHTML = ''; // Clear the existing list

        if (messages.length === 0) {
            messageListContainer.innerHTML = `<p class="text-muted p-3">No messages yet. Add one to get started!</p>`;
            return;
        }

        messages.forEach(message => {
            const deleteButtonHtml = message.isDefault ? '' :
                `<button class="btn btn-sm btn-outline-danger btn-delete" data-id="${message.id}">
                    <i class="bi bi-trash"></i>
                </button>`;

            const listItem = `
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <p class="mb-1">${message.text}</p>
                        ${message.isDefault ? '<small class="text-muted">Default Message</small>' : ''}
                    </div>
                    <div class="actions">
                        <button class="btn btn-sm btn-outline-secondary me-2 btn-edit" data-id="${message.id}">
                            <i class="bi bi-pencil"></i>
                        </button>
                        ${deleteButtonHtml}
                    </div>
                </div>
            `;
            messageListContainer.insertAdjacentHTML('beforeend', listItem);
        });
    };

    // --- EVENT HANDLERS ---
    const handleAddClick = () => {
        editingMessage = null;
        messageTextarea.value = '';
        messageModalLabel.textContent = 'Add New Message';
        messageModal.show();
    };

    const handleSaveClick = () => {
        const newText = messageTextarea.value.trim();
        if (!newText) return; // Basic validation

        if (editingMessage) {
            // Edit existing message
            const msgIndex = messages.findIndex(msg => msg.id === editingMessage.id);
            if (msgIndex > -1) {
                messages[msgIndex].text = newText;
            }
        } else {
            // Add new message
            messages.push({
                id: Date.now(),
                text: newText,
                isDefault: false,
            });
        }
        renderMessages();
        messageModal.hide();
    };

    const handleListClick = (e) => {
        const target = e.target.closest('button');
        if (!target) return;

        const messageId = parseInt(target.getAttribute('data-id'));

        // Handle Edit
        if (target.classList.contains('btn-edit')) {
            editingMessage = messages.find(msg => msg.id === messageId);
            if (editingMessage) {
                messageTextarea.value = editingMessage.text;
                messageModalLabel.textContent = 'Edit Message';
                messageModal.show();
            }
        }

        // Handle Delete
        if (target.classList.contains('btn-delete')) {
            if (confirm('Are you sure you want to delete this message?')) {
                messages = messages.filter(msg => msg.id !== messageId);
                renderMessages();
            }
        }
    };

    // --- INITIALIZATION ---
    document.getElementById('add-message-btn').addEventListener('click', handleAddClick);
    document.getElementById('save-message-btn').addEventListener('click', handleSaveClick);
    messageListContainer.addEventListener('click', handleListClick);

    // Initial render on page load
    renderMessages();
});