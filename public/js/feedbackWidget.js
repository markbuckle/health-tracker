// Production-ready feedbackWidget.js with environment detection
document.addEventListener("DOMContentLoaded", function () {
  // Get elements
  const widget = document.getElementById("feedback-widget");
  const toggleBtn = document.getElementById("feedback-toggle");
  const closeBtn = document.getElementById("feedback-close");
  const form = document.getElementById("feedback-form");
  
  // State management
  let feedbackState = 'default'; // 'default', 'success', 'error'
  
  // Environment detection and API configuration
  const getApiConfig = () => {
    const hostname = window.location.hostname;
    const isProduction = hostname.includes('vercel.app') || hostname.includes('nutraforge.ca');
    const isDevelopment = hostname === 'localhost' || hostname === '127.0.0.1';
    
    console.log('Environment detected:', { hostname, isProduction, isDevelopment });
    
    // Configure API endpoint based on environment
    if (isProduction) {
      return {
        endpoint: '/api/feedback', // Try the same endpoint first
        timeout: 10000, // 10 second timeout for production
        retries: 2
      };
    } else {
      return {
        endpoint: '/api/feedback',
        timeout: 5000, // 5 second timeout for development
        retries: 1
      };
    }
  };
  
  // Fetch with timeout and retry logic
  const fetchWithTimeout = async (url, options = {}, timeout = 5000, retries = 1) => {
    for (let i = 0; i <= retries; i++) {
      try {
        console.log(`Attempt ${i + 1} of ${retries + 1}: Fetching ${url}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        console.log(`Response received:`, {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          url: response.url
        });
        
        return response;
        
      } catch (error) {
        console.error(`Attempt ${i + 1} failed:`, error);
        
        if (i === retries) {
          throw error;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
  };
  
  // Update toggle button text based on state
  function updateToggleButton(state) {
    const buttonText = toggleBtn.querySelector('.button-text');
    const icon = toggleBtn.querySelector('.chat-icon');
    
    switch(state) {
      case 'success':
        if (buttonText) {
          buttonText.textContent = '';
        }
        toggleBtn.classList.add('success-state');
        toggleBtn.classList.remove('error-state');
        break;
      case 'error':
        if (buttonText) {
          buttonText.textContent = '';
        }
        toggleBtn.classList.add('error-state');
        toggleBtn.classList.remove('success-state');
        break;
      default:
        if (buttonText) {
          buttonText.textContent = '';
        }
        toggleBtn.classList.remove('success-state', 'error-state');
    }
    feedbackState = state;
  }

  // Toggle widget open/closed
  toggleBtn.addEventListener("click", function () {
    widget.classList.toggle("open");
    
    // If opening widget after success/error, reset to default state
    if (widget.classList.contains("open") && (feedbackState === 'success' || feedbackState === 'error')) {
      resetToDefaultState();
    }
  });

  // Close widget
  closeBtn.addEventListener("click", function () {
    widget.classList.remove("open");
  });

  // Handle form submission
  form.addEventListener("submit", async function (e) {
    e.preventDefault();

    const name = document.getElementById("feedback-name").value;
    const email = document.getElementById("feedback-email").value;
    const message = document.getElementById("feedback-message").value;
    
    const apiConfig = getApiConfig();

    // Show loading state
    const submitButton = form.querySelector('.feedback-submit');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Sending...';
    submitButton.disabled = true;

    try {
      console.log('Submitting feedback:', { name, email, message: message.substring(0, 50) + '...' });
      
      const response = await fetchWithTimeout(
        apiConfig.endpoint,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ name, email, message }),
        },
        apiConfig.timeout,
        apiConfig.retries
      );
      
      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        // Try to get more error details from response body
        try {
          const errorData = await response.text();
          console.log('Error response body:', errorData);
          
          // Try to parse as JSON first
          try {
            const errorJson = JSON.parse(errorData);
            errorMessage = errorJson.message || errorJson.error || errorMessage;
          } catch (e) {
            // If not JSON, use the text content if it's meaningful
            if (errorData && errorData.length < 200) {
              errorMessage = errorData;
            }
          }
        } catch (e) {
          console.log('Could not read error response body:', e);
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      console.log("Success response:", data);
      
      if (data.success) {
        showSuccessMessage();
        updateToggleButton('success');
        // Auto-close widget after 3 seconds
        setTimeout(() => {
          widget.classList.remove("open");
        }, 3000);
      } else {
        throw new Error(data.message || data.error || "Server returned unsuccessful response");
      }
      
    } catch (error) {
      console.error("Complete error details:", {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause
      });
      
      let userErrorMessage = error.message;
      
      // Provide specific error messages based on error type
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        userErrorMessage = "Request timed out. Please check your connection and try again.";
      } else if (error.message.includes('fetch')) {
        userErrorMessage = "Cannot connect to server. Please check your internet connection.";
      } else if (error.message.includes('404')) {
        userErrorMessage = "Feedback service not found. Please contact support.";
      } else if (error.message.includes('500')) {
        userErrorMessage = "Server error. Please try again in a few minutes.";
      } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
        userErrorMessage = "Network error. Please check your connection and try again.";
      }
      
      showErrorMessage(userErrorMessage);
      updateToggleButton('error');
      
    } finally {
      // Reset button state
      submitButton.textContent = originalText;
      submitButton.disabled = false;
    }
  });

  // Show success message after submission
  function showSuccessMessage() {
    const successDiv = document.createElement("div");
    successDiv.className = "feedback-success";

    successDiv.innerHTML = `
      <div class="success-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
      </div>
      <h3>Thank you for your feedback!</h3>
      <p>We appreciate you taking the time to share your thoughts with us.</p>
      <button class="feedback-submit" id="feedback-reset">Send another</button>
    `;

    // Replace form with success message
    const formContainer = form.parentNode;
    formContainer.removeChild(form);
    formContainer.appendChild(successDiv);

    // Add event listener to the "Send another" button
    document.getElementById("feedback-reset").addEventListener("click", function () {
      resetToDefaultState();
    });
  }

  // Show error message with debugging info (only in development)
  function showErrorMessage(errorMessage) {
    // Remove any existing error message
    const existingError = document.querySelector('.feedback-error');
    if (existingError) {
      existingError.remove();
    }

    const errorDiv = document.createElement("div");
    errorDiv.className = "feedback-error";
    
    const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    let debugInfo = '';
    if (isDevelopment) {
      debugInfo = `<small style="margin-top: 10px; color: #666; font-size: 11px; display: block;">
        Debug: Check browser console for detailed error information.<br>
        Environment: ${window.location.hostname}<br>
        API: ${getApiConfig().endpoint}
      </small>`;
    }

    errorDiv.innerHTML = `
      <div class="error-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      </div>
      <h3>Oops! Something went wrong</h3>
      <p>${errorMessage}</p>
      ${debugInfo}
      <button class="feedback-submit retry-button" id="feedback-retry">Try Again</button>
    `;

    // Insert error message before the form
    form.parentNode.insertBefore(errorDiv, form);

    // Add retry functionality
    document.getElementById("feedback-retry").addEventListener("click", function () {
      errorDiv.remove();
      updateToggleButton('default');
    });

    // Auto-hide error message after 15 seconds (longer for production debugging)
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.remove();
        updateToggleButton('default');
      }
    }, 15000);
  }

  // Reset widget to default state
  function resetToDefaultState() {
    // Remove success message and restore form if needed
    const successDiv = document.querySelector('.feedback-success');
    if (successDiv) {
      const formContainer = successDiv.parentNode;
      formContainer.removeChild(successDiv);
      formContainer.appendChild(form);
      form.reset();
    }
    
    // Remove any error messages
    const errorDiv = document.querySelector('.feedback-error');
    if (errorDiv) {
      errorDiv.remove();
    }
    
    // Reset toggle button
    updateToggleButton('default');
  }

  // Close widget when clicking outside
  document.addEventListener("click", function (e) {
    if (
      widget.classList.contains("open") &&
      !widget.contains(e.target) &&
      e.target !== toggleBtn
    ) {
      widget.classList.remove("open");
    }
  });

  // Initialize with default state
  updateToggleButton('default');
  
  // Log initial configuration for debugging
  console.log('Feedback widget initialized:', {
    environment: window.location.hostname,
    apiConfig: getApiConfig(),
    userAgent: navigator.userAgent.substring(0, 100)
  });
});