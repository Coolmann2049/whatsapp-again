let allTemplates = [];
let filteredTemplates = [];

document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let allTemplates = [];
    let filteredTemplates = [];

    // --- DOM REFERENCES ---
    const templateForm = document.getElementById('template-form');
    const templateNameInput = document.getElementById('template-name');
    const templateCategorySelect = document.getElementById('template-category');
    const templateContentInput = document.getElementById('template-content');
    const saveTemplateBtn = document.getElementById('save-template-btn');
    
    const templateListContainer = document.getElementById('template-list');
    const searchInput = document.getElementById('search-templates');
    const filterSelect = document.getElementById('filter-category');

    // --- RENDER FUNCTION ---
    const renderTemplates = () => {
        templateListContainer.innerHTML = ''; // Clear list
        if (filteredTemplates.length === 0) {
            templateListContainer.innerHTML = '<p class="text-center text-muted p-4">No templates found. Create one to get started!</p>';
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
                        <button class="btn btn-sm btn-outline-danger btn-delete-template" data-id="${template.id}" title="Delete Template">
                            <i class="bi bi-trash"></i>
                        </button>
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
            allTemplates = result.templates; 
            
            console.log(allTemplates);
            console.log(typeof(allTemplates));

            applyFilters();
        } catch (error) {
            console.error(error);
            templateListContainer.innerHTML = '<p class="text-center text-danger p-4">Could not load templates.</p>';
        }
    };

    const saveTemplate = async (e) => {
        e.preventDefault();
        const name = templateNameInput.value.trim();
        const type = templateCategorySelect.value;
        const content = templateContentInput.value.trim();

        if (!name || !type || !content) {
            alert('Please fill out all fields.');
            return;
        }

        saveTemplateBtn.disabled = true;
        saveTemplateBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Saving...';

        try {
            const response = await fetch('/api/data/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, type, content, variables: 'none' })
            });

            if (!response.ok) throw new Error('Failed to save template');
            
            templateForm.reset();
            await fetchTemplates(); // Refresh the list
        } catch (error) {
            console.error(error);
            alert('Error: Could not save template.');
        } finally {
            saveTemplateBtn.disabled = false;
            saveTemplateBtn.textContent = 'Save Template';
        }
    };

    const deleteTemplate = async (id) => {
        if (!confirm('Are you sure you want to delete this template?')) return;

        try {
            const response = await fetch(`/api/data/templates/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Failed to delete template');
            await fetchTemplates(); // Refresh the list
        } catch (error) {
            console.error(error);
            alert('Error: Could not delete template.');
        }
    };

    // --- ATTACH EVENT LISTENERS ---
    templateForm.addEventListener('submit', saveTemplate);
    searchInput.addEventListener('input', applyFilters);
    filterSelect.addEventListener('change', applyFilters);

    templateListContainer.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.btn-delete-template');
        if (deleteBtn) {
            deleteTemplate(deleteBtn.dataset.id);
        }
    });

    // --- INITIALIZATION ---
    fetchTemplates();
});