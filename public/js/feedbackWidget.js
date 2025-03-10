// feedback-widget.js - Add this to your public/js/ directory
document.addEventListener("DOMContentLoaded", function () {
  // Get elements
  const widget = document.getElementById("feedback-widget");
  const toggleBtn = document.getElementById("feedback-toggle");
  const closeBtn = document.getElementById("feedback-close");
  const form = document.getElementById("feedback-form");

  // Toggle widget open/closed
  toggleBtn.addEventListener("click", function () {
    widget.classList.toggle("open");
    widget.classList.toggle("closed");
  });

  // Close widget
  closeBtn.addEventListener("click", function () {
    widget.classList.remove("open");
    widget.classList.add("closed");
  });

  // Handle form submission
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    const name = document.getElementById("feedback-name").value;
    const email = document.getElementById("feedback-email").value;
    const message = document.getElementById("feedback-message").value;

    // Send the feedback data to your server using fetch API
    fetch("/api/feedback", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, email, message }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        if (data.success) {
          showSuccessMessage();
        } else {
          throw new Error(data.message || "Error submitting feedback");
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        // Show a friendly error message
        alert(
          "Sorry, there was a problem submitting your feedback. Please try again later."
        );
      });
  });

  // Show success message after submission
  function showSuccessMessage() {
    // Create success message elements
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
    document
      .getElementById("feedback-reset")
      .addEventListener("click", function () {
        formContainer.removeChild(successDiv);
        formContainer.appendChild(form);
        form.reset();
      });
  }

  // Close widget when clicking outside
  document.addEventListener("click", function (e) {
    if (
      widget.classList.contains("open") &&
      !widget.contains(e.target) &&
      e.target !== toggleBtn
    ) {
      widget.classList.remove("open");
      widget.classList.add("closed");
    }
  });
});
