// sidebar.js - Sidebar functionality

class SidebarManager {
    constructor() {
        this.mobileOpen = false;
        this.currentPage = this.getCurrentPageFromURL();
        this.init();
    }

    init() {
        this.bindEvents();
        this.setActiveNavLink();
    }

    getCurrentPageFromURL() {
        const path = window.location.pathname;
        const filename = path.split('/').pop();
        
        // Map filenames to page IDs
        const pageMap = {
            '': 'dashboard',
            '': 'dashboard',
            'campaigns': 'campaigns',
            'ai-config': 'ai-config',
            'chat-history': 'chat-history',
            'message-template': 'message-template',
            'auto-reply-settings': 'auto-reply-settings',
            'csv-upload': 'csv-upload',
            'profile': 'profile',
            'devices': 'devices'
        };

        return pageMap[filename] || 'dashboard';
    }

    bindEvents() {
        // Mobile menu toggle
        const mobileMenuToggle = document.getElementById('mobileMenuToggle');
        const sidebarOverlay = document.getElementById('sidebarOverlay');

        if (mobileMenuToggle) {
            mobileMenuToggle.addEventListener('click', () => this.toggleMobileMenu());
        }

        if (sidebarOverlay) {
            sidebarOverlay.addEventListener('click', () => this.closeMobileMenu());
        }

        // Navigation links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = link.getAttribute('data-page');
                this.navigateToPage(page);
            });
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            if (window.innerWidth >= 576) {
                this.closeMobileMenu();
            }
        });

        // Handle escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.mobileOpen) {
                this.closeMobileMenu();
            }
        });
    }

    toggleMobileMenu() {
        this.mobileOpen = !this.mobileOpen;
        
        const sidebar = document.getElementById('sidebar');
        const sidebarOverlay = document.getElementById('sidebarOverlay');
        
        if (this.mobileOpen) {
            sidebar.classList.add('show');
            sidebarOverlay.classList.add('show');
            document.body.style.overflow = 'hidden';
        } else {
            sidebar.classList.remove('show');
            sidebarOverlay.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    closeMobileMenu() {
        if (this.mobileOpen) {
            this.mobileOpen = false;
            const sidebar = document.getElementById('sidebar');
            const sidebarOverlay = document.getElementById('sidebarOverlay');
            
            sidebar.classList.remove('show');
            sidebarOverlay.classList.remove('show');
            document.body.style.overflow = '';
        }
    }

    navigateToPage(pageId) {
        // Page URL mapping
        const pageUrls = {
            'dashboard': 'dashboard',
            'campaigns': 'campaigns',
            'ai-config': 'ai-config',
            'chat-history': 'chat-history',
            'message-template': 'message-template',
            'auto-reply-settings': 'auto-reply-settings',
            'csv-upload': 'csv-upload',
            'profile': 'profile',
            'devices': 'devices'
        };

        const url = pageUrls[pageId];
        if (url) {
            window.location.href = url;
        }
    }

    setActiveNavLink() {
        // Remove active class from all links
        const navLinks = document.querySelectorAll('.nav-link');
        navLinks.forEach(link => link.classList.remove('active'));

        // Add active class to current page link
        const activeLink = document.querySelector(`[data-page="${this.currentPage}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
    }
}

// Initialize sidebar when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SidebarManager();
});