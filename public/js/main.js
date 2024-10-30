// Function for dropdown functionality
function dropdownScript() {
    document.addEventListener('DOMContentLoaded', () => {
        const dropdownToggles = document.querySelectorAll('.category-dropdown-toggle');
        
        dropdownToggles.forEach(toggle => {
            const arrow = toggle.querySelector('.dropdown-arrow');
            const dropdownList = toggle.nextElementSibling; // This gets the w-dropdown-list element
            const dropdownContentBottom = dropdownList.querySelector('.dropdown-content-bottom');
            
            toggle.addEventListener('click', () => {
                arrow.classList.toggle('active');
                dropdownList.classList.toggle('w--open');
                dropdownContentBottom.classList.toggle('show'); // Toggle the visibility of dropdown-content-bottom
            });

            const observer = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        const isOpen = dropdownList.classList.contains('w--open');
                        arrow.classList.toggle('active', isOpen);
                    }
                });
            });

            observer.observe(dropdownList, {
                attributes: true,
                attributeFilter: ['class']
            });
        });
    });
}

// Call the function to initialize dropdown script
dropdownScript();
