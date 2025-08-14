document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('create-account-form');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm-password');
    const phoneInput = document.getElementById('phone');
    const companyInput = document.getElementById('company');
    const submitBtn = document.getElementById('submit-btn');
    const formAlert = document.getElementById('form-alert');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // --- Frontend Validation ---
        formAlert.classList.add('d-none'); // Hide previous alerts
        const password = passwordInput.value;
        const confirmPassword = confirmPasswordInput.value;

        if (password !== confirmPassword) {
            showAlert('Passwords do not match.', 'danger');
            return;
        }

        const formData = {
            name: nameInput.value,
            email: emailInput.value,
            password: password,
            phone_number: phoneInput.value,
            company: companyInput.value
        };

        // --- API Call ---
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Creating...';

        try {
            const response = await fetch('/api/data/create-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'An unknown error occurred.');
            }

            // Success
            showAlert('Account created successfully! Redirecting to login...', 'success');
            setTimeout(() => {
                window.location.href = '/login'; // Redirect to login page
            }, 2000);

        } catch (error) {
            showAlert(error.message, 'danger');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Create Account';
        }
    });

    function showAlert(message, type) {
        formAlert.textContent = message;
        formAlert.className = `alert alert-${type}`; // Reset classes and add new ones
    }
});