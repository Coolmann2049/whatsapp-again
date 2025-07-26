document.addEventListener('DOMContentLoaded', () => {
    // --- STATE & DATA ---
    let files = [{
        id: 1,
        name: 'contacts_list_1.csv',
        status: 'completed',
        total: 150,
        processed: 150,
        date: '2023-07-20',
    }, {
        id: 2,
        name: 'new_leads.csv',
        status: 'processing',
        total: 200,
        processed: 120,
        date: '2023-07-21',
    }, ];

    // --- DOM REFERENCES ---
    const fileListBody = document.getElementById('file-list-body');
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('csv-upload-input');
    const previewModalTitle = document.getElementById('previewModalTitle');

    // --- HELPER FUNCTIONS ---
    const getStatusBadge = (status) => {
        const colors = {
            completed: 'success',
            processing: 'warning',
            error: 'danger',
            pending: 'secondary'
        };
        return `<span class="badge bg-${colors[status] || 'light'}">${status}</span>`;
    };

    // --- RENDER FUNCTION ---
    const renderFiles = () => {
        fileListBody.innerHTML = ''; // Clear table
        files.forEach(file => {
            const progressPercent = file.total > 0 ? (file.processed / file.total) * 100 : 0;
            const rowHtml = `
                <tr>
                    <td>${file.name}</td>
                    <td>${file.date}</td>
                    <td>${getStatusBadge(file.status)}</td>
                    <td>
                        <div class="progress" style="height: 10px;">
                            <div class="progress-bar" role="progressbar" style="width: ${progressPercent}%" aria-valuenow="${progressPercent}" aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                        <small class="text-muted">${file.processed} / ${file.total} rows</small>
                    </td>
                    <td class="text-end">
                        <button class="btn btn-sm btn-outline-secondary btn-preview" data-id="${file.id}" data-bs-toggle="modal" data-bs-target="#previewModal" title="Preview"><i class="bi bi-eye"></i></button>
                        <a href="#" class="btn btn-sm btn-outline-secondary" title="Download"><i class="bi bi-download"></i></a>
                        <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${file.id}" title="Delete"><i class="bi bi-trash"></i></button>
                    </td>
                </tr>
            `;
            fileListBody.insertAdjacentHTML('beforeend', rowHtml);
        });
    };

    // --- EVENT HANDLERS ---
    const handleFileSelect = (uploadedFile) => {
        if (!uploadedFile || !uploadedFile.name.endsWith('.csv')) {
            alert('Please upload a valid .csv file.');
            return;
        }
        const newFile = {
            id: Date.now(),
            name: uploadedFile.name,
            status: 'pending',
            total: 0, // Should be determined after parsing
            processed: 0,
            date: new Date().toISOString().split('T')[0],
        };
        files.unshift(newFile); // Add new file to the top
        renderFiles();
    };

    const handleTableActions = (e) => {
        const target = e.target.closest('button');
        if (!target) return;
        
        const fileId = parseInt(target.dataset.id);

        if (target.classList.contains('btn-delete')) {
            if (confirm('Are you sure you want to delete this file history?')) {
                files = files.filter(f => f.id !== fileId);
                renderFiles();
            }
        }
        
        if (target.classList.contains('btn-preview')) {
            const file = files.find(f => f.id === fileId);
            if(file) {
                 previewModalTitle.textContent = `Data Preview: ${file.name}`;
            }
        }
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
    fileListBody.addEventListener('click', handleTableActions);

    // --- INITIAL RENDER ---
    renderFiles();
});