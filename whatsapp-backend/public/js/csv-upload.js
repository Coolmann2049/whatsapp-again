document.addEventListener('DOMContentLoaded', () => {
    // --- STATE & DATA ---
    let uploadHistory = [];
    let manualContacts = [];

    // --- DOM REFERENCES ---
    const fileListBody = document.getElementById('file-list-body');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('csv-upload-input');
    
    // New Manual Entry DOM refs
    const manualContactForm = document.getElementById('manual-contact-form');
    const manualContactsBody = document.getElementById('manual-contacts-body');
    const manualPhoneInput = document.getElementById('manual-phone');
    const manualNameInput = document.getElementById('manual-name');
    const manualCompanyInput = document.getElementById('manual-company');

    // --- HELPER FUNCTIONS ---
    const getStatusBadge = (status) => {
        const colors = { completed: 'success', processing: 'warning', failed: 'danger' };
        return `<span class="badge bg-${colors[(status || '').toLowerCase()] || 'secondary'}">${status}</span>`;
    };

    // --- RENDER FUNCTIONS ---
    const renderUploadHistory = () => {
        fileListBody.innerHTML = '';
        const csvFiles = uploadHistory.filter(f => f.file_name !== 'Manually Added Contacts');
        if (csvFiles.length === 0) {
            fileListBody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">No CSV files uploaded yet.</td></tr>`;
            return;
        }
        csvFiles.forEach(file => {
            const rowHtml = `
                <tr>
                    <td>${file.file_name}</td>
                    <td>${new Date(file.upload_date || file.createdAt).toLocaleDateString()}</td>
                    <td>${getStatusBadge(file.status)}</td>
                    <td>${file.total_contacts}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-danger btn-delete-history" data-id="${file.id}" title="Delete History"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>
            `;
            fileListBody.insertAdjacentHTML('beforeend', rowHtml);
        });
    };

    const renderManualContacts = () => {
        manualContactsBody.innerHTML = '';
        if (manualContacts.length === 0) {
            manualContactsBody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">No contacts added manually.</td></tr>`;
            return;
        }
        manualContacts.forEach(contact => {
            const rowHtml = `
                <tr>
                    <td>${contact.phone}</td>
                    <td>${contact.name}</td>
                    <td>${contact.company}</td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-danger btn-delete-contact" data-id="${contact.id}" title="Delete Contact"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>
            `;
            manualContactsBody.insertAdjacentHTML('beforeend', rowHtml);
        });
    };

    // --- API & DATA HANDLING ---
    const fetchInitialData = async () => {
        try {
            const [historyRes, contactsRes] = await Promise.all([
                fetch('/api/csv/upload-history'),
                fetch('/api/data/contacts') // Assuming you have an endpoint to get all contacts
            ]);
            if (!historyRes.ok || !contactsRes.ok) throw new Error('Failed to fetch initial data.');
            
            uploadHistory = await historyRes.json();
            const allContacts = await contactsRes.json();
            
            const manualHistory = uploadHistory.find(f => f.file_name === 'Manually Added Contacts');
            if (manualHistory) {
                manualContacts = allContacts.filter(c => c.uploadHistoryId === manualHistory.id);
            }
            
            renderUploadHistory();
            renderManualContacts();
        } catch (error) {
            console.error(error);
            alert('Could not load page data. Please refresh.');
        }
    };

    const uploadFile = async (fileToUpload) => {
        // ... (this function remains the same as before) ...
        // On success, it should call fetchInitialData() to refresh everything.
    };

    const addManualContact = async (e) => {
        e.preventDefault();
        const phone = manualPhoneInput.value;
        const name = manualNameInput.value;
        const company = manualCompanyInput.value;

        if (!phone) {
            alert('Phone number is required.');
            return;
        }

        try {
            const response = await fetch('/api/data/contacts/manual', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, name, company })
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error);
            }
            manualContactForm.reset();
            await fetchInitialData(); // Refresh both lists
        } catch (error) {
            console.error(error);
            alert(`Error: ${error.message}`);
        }
    };

    const deleteContact = async (contactId) => {
        if (!confirm('Are you sure you want to delete this contact?')) return;
        try {
            const response = await fetch(`/api/data/contacts/${contactId}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete contact');
            await fetchInitialData();
        } catch (error) {
            console.error(error);
            alert('Error deleting contact.');
        }
    };
    
    // ... (Your other event handlers like handleFileSelect, delete history, etc.) ...

    // --- ATTACH EVENT LISTENERS ---
    manualContactForm.addEventListener('submit', addManualContact);
    manualContactsBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.btn-delete-contact');
        if (deleteBtn) {
            deleteContact(deleteBtn.dataset.id);
        }
    });
    // ... (Your other event listeners for CSV upload) ...

    // --- INITIAL FETCH ---
    fetchInitialData();
});