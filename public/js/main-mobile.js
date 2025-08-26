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

// Enhanced Mobile Touch Interactions for Header Links
document.addEventListener('DOMContentLoaded', function() {
    
    // Function to detect if device is touch-capable
    function isTouchDevice() {
        return (('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0) ||
               (navigator.msMaxTouchPoints > 0));
    }
    
    // Enhanced touch feedback for mobile nav links
    function initMobileTouchEffects() {
        const mobileNavLinks = document.querySelectorAll('.mobile-nav-links-horizontal .mobile-nav-link');
        
        if (!mobileNavLinks.length) return;
        
        mobileNavLinks.forEach(link => {
            let touchStartTime = 0;
            let feedbackTimeout;
            
            // Touch start - immediate visual feedback
            link.addEventListener('touchstart', function(e) {
                touchStartTime = Date.now();
                
                // Add immediate pressed state
                this.classList.add('pressed');
                
                // Clear any existing feedback timeout
                clearTimeout(feedbackTimeout);
                
                // Prevent default to avoid potential hover states
                e.preventDefault();
            }, { passive: false });
            
            // Touch end - provide feedback and handle navigation
            link.addEventListener('touchend', function(e) {
                const touchDuration = Date.now() - touchStartTime;
                
                // Remove pressed state after a short delay for visual feedback
                feedbackTimeout = setTimeout(() => {
                    this.classList.remove('pressed');
                }, 150);
                
                // If it was a quick tap (not a scroll), add the feedback animation
                if (touchDuration < 200) {
                    // Add touch feedback animation
                    this.classList.add('touch-feedback');
                    
                    // Remove the animation class after it completes
                    setTimeout(() => {
                        this.classList.remove('touch-feedback');
                    }, 400);
                    
                    // Navigate after providing visual feedback
                    setTimeout(() => {
                        const href = this.getAttribute('href');
                        if (href) {
                            window.location.href = href;
                        }
                    }, 200);
                }
                
                e.preventDefault();
            });
            
            // Touch cancel - clean up if touch is interrupted
            link.addEventListener('touchcancel', function() {
                this.classList.remove('pressed');
                clearTimeout(feedbackTimeout);
            });
            
            // Handle mouse events for desktop fallback (when testing on desktop)
            if (!isTouchDevice()) {
                link.addEventListener('mousedown', function() {
                    this.classList.add('pressed');
                });
                
                link.addEventListener('mouseup', function() {
                    setTimeout(() => {
                        this.classList.remove('pressed');
                    }, 150);
                });
                
                link.addEventListener('mouseleave', function() {
                    this.classList.remove('pressed');
                });
            }
        });
    }
    
    // Enhanced feedback for other mobile navigation elements
    function initGeneralMobileTouchEffects() {
        const allMobileNavLinks = document.querySelectorAll('.mobile-nav-link');
        
        allMobileNavLinks.forEach(link => {
            // Skip if already handled by the horizontal links function
            if (link.closest('.mobile-nav-links-horizontal')) return;
            
            link.addEventListener('touchstart', function() {
                this.style.backgroundColor = 'rgba(92, 177, 93, 0.1)';
                this.style.color = '#5cb15d';
            }, { passive: true });
            
            link.addEventListener('touchend', function() {
                // Keep the effect visible for a brief moment
                setTimeout(() => {
                    this.style.backgroundColor = '';
                    this.style.color = '';
                }, 200);
            });
            
            link.addEventListener('touchcancel', function() {
                this.style.backgroundColor = '';
                this.style.color = '';
            });
        });
    }
    
    // Add haptic feedback for supported devices
    function addHapticFeedback(element) {
        element.addEventListener('touchstart', function() {
            // Light haptic feedback if available
            if (navigator.vibrate) {
                navigator.vibrate(10); // Very brief vibration
            }
        }, { passive: true });
    }
    
    // Initialize all touch effects
    function initAllTouchEffects() {
        if (isTouchDevice()) {
            console.log('Touch device detected, initializing mobile touch effects');
            initMobileTouchEffects();
            initGeneralMobileTouchEffects();
            
            // Add haptic feedback to primary navigation links
            const primaryNavLinks = document.querySelectorAll('.mobile-nav-links-horizontal .mobile-nav-link');
            primaryNavLinks.forEach(addHapticFeedback);
        }
    }
    
    // Run initialization
    initAllTouchEffects();
    
    // Re-initialize if the mobile menu is dynamically created
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'childList') {
                const addedNodes = Array.from(mutation.addedNodes);
                const hasMobileNav = addedNodes.some(node => 
                    node.nodeType === 1 && 
                    (node.classList?.contains('mobile-nav') || 
                     node.querySelector?.('.mobile-nav'))
                );
                
                if (hasMobileNav) {
                    setTimeout(initAllTouchEffects, 100);
                }
            }
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
});

// Additional utility functions for better mobile experience
function improveScrollingExperience() {
    // Prevent elastic scroll on mobile nav when menu is open
    document.addEventListener('touchmove', function(e) {
        const mobileNav = document.querySelector('.mobile-nav.open');
        if (mobileNav && !mobileNav.contains(e.target)) {
            e.preventDefault();
        }
    }, { passive: false });
}

// Initialize scroll improvements
document.addEventListener('DOMContentLoaded', improveScrollingExperience);

// Export functions for external use if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initMobileTouchEffects,
        isTouchDevice
    };
}