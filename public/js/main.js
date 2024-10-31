// // Function for dropdown functionality
// function dropdownScript() {
//     document.addEventListener('DOMContentLoaded', () => {
//         const dropdownToggles = document.querySelectorAll('.category-dropdown-toggle');
        
//         dropdownToggles.forEach(toggle => {
//             const arrow = toggle.querySelector('.dropdown-arrow');
//             const dropdownList = toggle.nextElementSibling; // This gets the w-dropdown-list element
//             const dropdownContentBottom = dropdownList.querySelector('.dropdown-content-bottom');
            
//             toggle.addEventListener('click', () => {
//                 arrow.classList.toggle('active');
//                 dropdownList.classList.toggle('w--open');
//                 dropdownContentBottom.classList.toggle('show'); // Toggle the visibility of dropdown-content-bottom
//             });

//             const observer = new MutationObserver((mutations) => {
//                 mutations.forEach((mutation) => {
//                     if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
//                         const isOpen = dropdownList.classList.contains('w--open');
//                         arrow.classList.toggle('active', isOpen);
//                     }
//                 });
//             });

//             observer.observe(dropdownList, {
//                 attributes: true,
//                 attributeFilter: ['class']
//             });
//         });
//     });
// }

// // Function for nested dropdown functionality
// function nestedDropdownScript() {
//     const biomarkerContainers = document.querySelectorAll('.biomarker-container');
    
//     biomarkerContainers.forEach(container => {
//         const dropdown = container.querySelector('.biomarker-dropdown');
//         const stripes = dropdown.querySelectorAll('.stripe-1, .stripe-2');
//         const biomarkerBottom = container.querySelector('.biomarker-bottom');
        
//         container.addEventListener('click', () => {
//             stripes.forEach(stripe => stripe.classList.toggle('spin'));
//             biomarkerBottom.classList.toggle('show');
//             container.classList.toggle('active');
//         });
//     });
// }


// dropdownScript(); // Call the function to initialize dropdown script
// nestedDropdownScript(); // Call the function to initialize nested dropdown script

function responsiveSidebar() {
    document.addEventListener('DOMContentLoaded', () => {
        const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
        const sidebar = document.querySelector('.sidebar');

        mobileMenuToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    });
}
responsiveSidebar();