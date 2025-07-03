// ------ Mobile Menu JavaScript
document.addEventListener('DOMContentLoaded', function() {
  const hamburgerButton = document.getElementById('hamburger-button');
  
  // Look for both possible mobile menu selectors
  const mobileNav = document.getElementById('mobile-nav') || document.querySelector('.mobile-nav');
  const mobileMenu = document.querySelector('.mobile-menu');
  
  // Use whichever menu exists
  const activeMenu = mobileNav || mobileMenu;
  
  if (!hamburgerButton || !activeMenu) {
    console.log('Mobile menu elements not found, skipping initialization');
    return;
  }
  
  // Remove any existing event listeners by cloning the button
  const newHamburgerButton = hamburgerButton.cloneNode(true);
  hamburgerButton.parentNode.replaceChild(newHamburgerButton, hamburgerButton);
  
  function toggleMobileMenu() {
    // CRITICAL: Only allow toggle if screen width is 767px or below
    if (window.innerWidth <= 767) {
      newHamburgerButton.classList.toggle('open');
      activeMenu.classList.toggle('open');
      
      // Handle different menu types
      if (mobileMenu) {
        mobileMenu.classList.toggle('mobile-menu-closed');
      }
      
      const menuHeight = activeMenu.scrollHeight;
      document.documentElement.style.setProperty('--mobile-menu-height', menuHeight + 'px');
      document.body.classList.toggle('menu-open');
    }
  }
  
  // Single event listener with strict desktop prevention
  newHamburgerButton.addEventListener('click', function(e) {
    // BLOCK ALL DESKTOP INTERACTIONS
    if (window.innerWidth > 767) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
    toggleMobileMenu();
  });
  
  // Close menu when clicking navigation links (mobile only)
  const menuLinks = activeMenu.querySelectorAll('a');
  menuLinks.forEach(link => {
    link.addEventListener('click', function() {
      setTimeout(() => {
        if (activeMenu.classList.contains('open') && window.innerWidth <= 767) {
          toggleMobileMenu();
        }
      }, 100);
    });
  });
  
  // Handle window resize
  window.addEventListener('resize', function() {
    if (window.innerWidth > 767 && activeMenu.classList.contains('open')) {
      newHamburgerButton.classList.remove('open');
      activeMenu.classList.remove('open');
      if (mobileMenu) {
        mobileMenu.classList.add('mobile-menu-closed');
      }
      document.body.classList.remove('menu-open');
      document.documentElement.style.setProperty('--mobile-menu-height', '0px');
    }
  });
  
  // Override any global toggleMenu functions
  window.toggleMenu = function() {
    if (window.innerWidth <= 767) {
      newHamburgerButton.click();
    }
  };
});