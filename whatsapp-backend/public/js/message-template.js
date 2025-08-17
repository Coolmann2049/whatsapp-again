document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let allTemplates = [];
    let filteredTemplates = [];
    let editingTemplateId = null; // To track if we are editing

    // --- DOM REFERENCES ---
    const templateForm = document.getElementById('template-form');
    const formTitle = document.getElementById('form-title');
    const templateNameInput = document.getElementById('template-name');
    const templateCategorySelect = document.getElementById('template-category');
    const templateContentInput = document.getElementById('template-content');
    const saveTemplateBtn = document.getElementById('save-template-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    
    const templateListContainer = document.getElementById('template-list');
    const searchInput = document.getElementById('search-templates');
    const filterSelect = document.getElementById('filter-category');

    // --- RENDER FUNCTION ---
    const renderTemplates = () => {
        templateListContainer.innerHTML = '';
        if (filteredTemplates.length === 0) {
            templateListContainer.innerHTML = '<p class="text-center text-muted p-4">No templates found.</p>';
            return;
        }

        filteredTemplates.forEach(template => {
            const templateHtml = `
                <div class="list-group-item">
                    <div class="d-flex justify-content-between align-items-start">
                        <div>
                            <h6 class="mb-1">${template.name}</h6>
                            <p class="mb-1 text-muted small">${template.content.substring(0, 120)}...</p>
                            <span class="badge bg-secondary">${template.type}</span>
                        </div>
                        <div>
                            <button class="btn btn-sm btn-outline-secondary btn-edit-template me-1" data-id="${template.id}" title="Edit Template"><i class="bi bi-pencil"></i></button>
                            <button class="btn btn-sm btn-outline-danger btn-delete-template" data-id="${template.id}" title="Delete Template"><i class="bi bi-trash"></i></button>
                        </div>
                    </div>
                </div>
            `;
            templateListContainer.insertAdjacentHTML('beforeend', templateHtml);
        });
    };

    // --- FILTER & SEARCH ---
    const applyFilters = () => {
        const searchTerm = searchInput.value.toLowerCase();
        const categoryFilter = filterSelect.value;

        filteredTemplates = allTemplates.filter(template => {
            const matchesCategory = categoryFilter === 'all' || template.type === categoryFilter;
            const matchesSearch = template.name.toLowerCase().includes(searchTerm) || template.content.toLowerCase().includes(searchTerm);
            return matchesCategory && matchesSearch;
        });

        renderTemplates();
    };

    // --- API FUNCTIONS ---
    const fetchTemplates = async () => {
        try {
            const response = await fetch('/api/data/templates');
            if (!response.ok) throw new Error('Failed to fetch templates');
            const result = await response.json();
            allTemplates = result.templates || [];
            applyFilters();
        } catch (error) {
            console.error(error);
            templateListContainer.innerHTML = '<p class="text-center text-danger p-4">Could not load templates.</p>';
        }
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        const name = templateNameInput.value.trim();
        const type = templateCategorySelect.value;
        const content = templateContentInput.value.trim();

        if (!name || !type || !content) {
            alert('Please fill out all fields.');
            return;
        }

        const isUpdating = !!editingTemplateId;
        const url = isUpdating ? `/api/data/templates/${editingTemplateId}` : '/api/data/templates';
        const method = isUpdating ? 'PUT' : 'POST';

        saveTemplateBtn.disabled = true;
        saveTemplateBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

        try {
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, type, content })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || `Failed to ${isUpdating ? 'update' : 'save'} template`);
            }
            
            resetForm();
            await fetchTemplates();
        } catch (error) {
            console.error(error);
            alert(`Error: ${error.message}`);
        } finally {
            saveTemplateBtn.disabled = false;
            saveTemplateBtn.textContent = 'Save Template';
        }
    };

    const deleteTemplate = async (id) => {
        if (!confirm('Are you sure you want to delete this template?')) return;

        try {
            const response = await fetch(`/api/data/templates/${id}`, { method: 'DELETE' });
            if (!response.ok) {
                 const err = await response.json();
                throw new Error(err.error || 'Failed to delete template');
            }
            await fetchTemplates();
        } catch (error) {
            console.error(error);
            alert(`Error: ${error.message}`);
        }
    };

    // --- EVENT HANDLERS & UI LOGIC ---
    const resetForm = () => {
        templateForm.reset();
        editingTemplateId = null;
        formTitle.innerHTML = '<i class="bi bi-plus-lg me-2"></i>Create Template';
        saveTemplateBtn.textContent = 'Save Template';
        cancelEditBtn.classList.add('d-none');
    };

    const populateFormForEdit = (templateId) => {
        const template = allTemplates.find(t => t.id === templateId);
        if (!template) return;

        editingTemplateId = template.id;
        templateNameInput.value = template.name;
        templateCategorySelect.value = template.type;
        templateContentInput.value = template.content;

        formTitle.innerHTML = '<i class="bi bi-pencil me-2"></i>Edit Template';
        saveTemplateBtn.textContent = 'Update Template';
        cancelEditBtn.classList.remove('d-none');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // --- ATTACH EVENT LISTENERS ---
    templateForm.addEventListener('submit', handleFormSubmit);
    searchInput.addEventListener('input', applyFilters);
    filterSelect.addEventListener('change', applyFilters);
    cancelEditBtn.addEventListener('click', resetForm);

    templateListContainer.addEventListener('click', (e) => {
        const targetButton = e.target.closest('button');
        if (!targetButton) return;

        const id = parseInt(targetButton.dataset.id);
        if (targetButton.classList.contains('btn-delete-template')) {
            deleteTemplate(id);
        } else if (targetButton.classList.contains('btn-edit-template')) {
            populateFormForEdit(id);
        }
    });

    // --- INITIALIZATION ---
    fetchTemplates();
});