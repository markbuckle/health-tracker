function confirmLogout(event) {
  event.preventDefault();
  
  // Create modal overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  // Create modal
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: white;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    max-width: 300px;
    text-align: center;
  `;
  
  modal.innerHTML = `
    <div style="margin-bottom: 20px; font-size: 16px; font-weight: 500;">
      Are you sure you want to log out?
    </div>
    <div style="display: flex; gap: 12px;">
      <button id="cancelLogout" style="
        flex: 1;
        padding: 8px 16px;
        border: 1px solid #e9ecef;
        background: #f8f9fa;
        border-radius: 6px;
        cursor: pointer;
      ">Cancel</button>
      <button id="confirmLogout" style="
        flex: 1;
        padding: 8px 16px;
        border: 1px solid #dc3545;
        background: #dc3545;
        color: white;
        border-radius: 6px;
        cursor: pointer;
      ">Log out</button>
    </div>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Handle clicks
  document.getElementById('cancelLogout').onclick = () => {
    document.body.removeChild(overlay);
  };
  
  document.getElementById('confirmLogout').onclick = () => {
    window.location.href = "/logout";
  };
  
  // Close on overlay click
  overlay.onclick = (e) => {
    if (e.target === overlay) {
      document.body.removeChild(overlay);
    }
  };
}