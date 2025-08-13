document.addEventListener('DOMContentLoaded', () => {
    // --- STATE & DATA ---
    let uploadHistory = [];
    let manualContacts = [];

    // --- DOM REFERENCES ---
    const fileListBody = document.getElementById('file-list-body');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('csv-upload-input');
    
    // Manual Entry DOM refs
    const manualContactForm = document.getElementById('manual-contact-form');
    const manualContactsBody = document.getElementById('manual-contacts-body');
    const manualPhoneInput = document.getElementById('manual-phone');
    const manualNameInput = document.getElementById('manual-name');
    const manualCompanyInput = document.getElementById('manual-company');

    // --- HELPER FUNCTIONS ---
    const getStatusBadge = (status) => {
        const colors = { completed: 'success', processing: 'warning', failed: 'danger' };
        const sanitizedStatus = (status || 'unknown').toLowerCase();
        return `<span class="badge bg-${colors[sanitizedStatus] || 'secondary'}">${status}</span>`;
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
            const [historyRes, manualContactsRes] = await Promise.all([
                fetch('/api/csv/upload-history'),
                fetch('/api/data/contacts/manual')
            ]);
            if (!historyRes.ok || !manualContactsRes.ok) throw new Error('Failed to fetch initial data.');
            
            uploadHistory = await historyRes.json();
            manualContacts = await manualContactsRes.json();
            
            renderUploadHistory();
            renderManualContacts();
        } catch (error) {
            console.error(error);
            alert('Could not load page data. Please refresh.');
        }
    };

    const uploadFile = async (fileToUpload) => {
        const tempId = Date.now();
        const newFileEntry = {
            id: tempId,
            file_name: fileToUpload.name,
            status: 'Processing',
            total_contacts: '...',
            upload_date: new Date().toISOString(),
        };
        uploadHistory.unshift(newFileEntry);
        renderUploadHistory();

        const formData = new FormData();
        formData.append('csvFile', fileToUpload);

        try {
            const response = await fetch('/api/csv/upload-contacts', {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Upload failed');
            
            await fetchInitialData(); // Refresh all data from server
        } catch (error) {
            console.error('Upload error:', error);
            const errorFileEntry = uploadHistory.find(f => f.id === tempId);
            if (errorFileEntry) {
                errorFileEntry.status = 'Failed';
                errorFileEntry.total_contacts = 0;
            }
            alert(`Error: ${error.message}`);
            renderUploadHistory();
        }
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

        const addButton = e.target.querySelector('button[type="submit"]');
        addButton.disabled = true;

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
            await fetchInitialData();
        } catch (error) {
            console.error(error);
            alert(`Error: ${error.message}`);
        } finally {
            addButton.disabled = false;
        }
    };

    const deleteManualContact = async (contactId) => {
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
    
    const deleteHistoryRecord = async (historyId) => {
        const fileToDelete = uploadHistory.find(f => f.id === historyId);
        const fileName = fileToDelete ? fileToDelete.file_name : 'this file';

        if (!confirm(`Are you sure you want to delete "${fileName}" and all its associated contacts? This action cannot be undone.`)) return;
        
        try {
            const response = await fetch(`/api/csv/upload-history/${historyId}`, { method: 'DELETE' });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Server error');
            }
            await fetchInitialData();
            alert('Upload record and associated contacts deleted successfully!');
        } catch (error) {
            console.error('Failed to delete upload record:', error);
            alert(`Error: ${error.message}`);
        }
    };

    // --- EVENT HANDLERS ---
    const handleFileSelect = (uploadedFile) => {
        if (!uploadedFile) return;
        if (!uploadedFile.name.toLowerCase().endsWith('.csv')) {
            alert('Please upload a valid .csv file.');
            return;
        }
        uploadFile(uploadedFile);
    };
    
    // --- DRAG & DROP ---
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        if (e.dataTransfer.files.length) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });

    // --- ATTACH EVENT LISTENERS ---
    fileInput.addEventListener('change', (e) => handleFileSelect(e.target.files[0]));
    manualContactForm.addEventListener('submit', addManualContact);

    fileListBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.btn-delete-history');
        if (deleteBtn) {
            deleteHistoryRecord(parseInt(deleteBtn.dataset.id));
        }
    });

    manualContactsBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.btn-delete-contact');
        if (deleteBtn) {
            deleteManualContact(parseInt(deleteBtn.dataset.id));
        }
    });

    // --- INITIAL FETCH ---
    fetchInitialData();
});