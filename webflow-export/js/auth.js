// This file contains the client-side JavaScript that interacts with your authentication API. It handles the form submission on the front end and manages the storage of the JWT token in the browser.

// Wait for the DOM to fully load before running the script
document.addEventListener('DOMContentLoaded', () => {
    // Get the login form and error message elements
    const loginForm = document.getElementById('login-form');
    const errorMessage = document.querySelector('.w-form-fail');

    // Add an event listener for form submission
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevent the default form submission behavior

        // Get the values of the email and password input fields
        const email = document.getElementById('Email').value;
        const password = document.getElementById('password').value;

        try {
            // Send a POST request to the login API with the email and password
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            if (response.ok) {
                // If the response is OK, parse the JSON data
                const data = await response.json();
                // Store the token in local storage
                localStorage.setItem('token', data.token);
                // Redirect to the dashboard or home page
                window.location.href = '/dashboard.html';
            } else {
                // If the response is not OK, show the error message
                const errorData = await response.json();
                errorMessage.style.display = 'block';
                errorMessage.querySelector('div').textContent = errorData.message || 'Login failed. Please try again.';
            }
        } catch (error) {
            // Log any errors to the console and show a generic error message
            console.error('Error:', error);
            errorMessage.style.display = 'block';
            errorMessage.querySelector('div').textContent = 'An error occurred during login. Please try again later.';
        }
    });

    // Toggle password visibility
    const passwordInput = document.getElementById('password');
    const eyeOpen = document.getElementById('eye-open');
    const eyeClose = document.getElementById('eye-close');

    // Show the password as plain text when the eye icon is clicked
    eyeOpen.addEventListener('click', () => {
        passwordInput.type = 'text';
        eyeOpen.style.display = 'none';
        eyeClose.style.display = 'block';
    });

    // Hide the password when the eye icon is clicked again
    eyeClose.addEventListener('click', () => {
        passwordInput.type = 'password';
        eyeClose.style.display = 'none';
        eyeOpen.style.display = 'block';
    });
});
