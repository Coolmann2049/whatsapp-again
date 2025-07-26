document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let keywords = [];

    // --- DOM ELEMENT REFERENCES ---
    const keywordInput = document.getElementById('keyword-input');
    const keywordsContainer = document.getElementById('keywords-container');
    const saveButton = document.getElementById('save-config-btn');
    const saveAlert = document.getElementById('save-alert');
    const formElements = document.querySelectorAll('.form-control, .form-select, .form-range');

    // --- RENDER FUNCTION ---
    const renderKeywords = () => {
        keywordsContainer.innerHTML = ''; // Clear existing keywords
        keywords.forEach(keyword => {
            const chip = `
                <div class="keyword-chip">
                    <span>${keyword}</span>
                    <button type="button" class="btn-close" aria-label="Close" data-keyword="${keyword}"></button>
                </div>
            `;
            keywordsContainer.insertAdjacentHTML('beforeend', chip);
        });
    };

    // --- EVENT HANDLERS ---
    const handleAddKeyword = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const newKeyword = keywordInput.value.trim();
            if (newKeyword && !keywords.includes(newKeyword)) {
                keywords.push(newKeyword);
                renderKeywords();
            }
            keywordInput.value = ''; // Clear input
        }
    };
    
    const handleDeleteKeyword = (e) => {
        if (e.target.matches('.btn-close')) {
            const keywordToDelete = e.target.dataset.keyword;
            keywords = keywords.filter(kw => kw !== keywordToDelete);
            renderKeywords();
        }
    };
    
    const handleSave = () => {
        // In a real app, you would gather all form data here and send to a backend.
        const configData = {
            businessInfo: {
                name: document.getElementById('businessName').value,
                industry: document.getElementById('industry').value,
                description: document.getElementById('description').value,
                targetAudience: document.getElementById('targetAudience').value,
                keyProducts: document.getElementById('keyProducts').value,
                tonePreference: document.getElementById('tonePreference').value,
            },
            personality: {
                formality: document.getElementById('formality').value,
                friendliness: document.getElementById('friendliness').value,
                creativity: document.getElementById('creativity').value,
                detail: document.getElementById('detail').value,
            },
            keywords: keywords
        };

        console.log("Saving Configuration:", configData); // Simulate saving

        // Show success alert
        saveAlert.classList.remove('d-none');
        // Hide it after 3 seconds
        setTimeout(() => {
            saveAlert.classList.add('d-none');
        }, 3000);
    };

    // --- ATTACH EVENT LISTENERS ---
    keywordInput.addEventListener('keyup', handleAddKeyword);
    keywordsContainer.addEventListener('click', handleDeleteKeyword);
    saveButton.addEventListener('click', handleSave);
    
    // Hide save alert if any form field is changed
    formElements.forEach(el => {
        el.addEventListener('input', () => {
            saveAlert.classList.add('d-none');
        });
    });

    // --- INITIAL RENDER ---
    renderKeywords();
});