// Main JavaScript for SilentGambles

document.addEventListener('DOMContentLoaded', function() {
    // Add smooth scrolling to all links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // Toggle live stream container
    const streamContainer = document.querySelector('.live-stream-container');
    const streamToggle = document.querySelector('.stream-toggle');

    if (streamContainer && streamToggle) {
        streamToggle.addEventListener('click', function() {
            streamContainer.classList.toggle('collapsed');
        });
    }

    // Copy to clipboard functionality
    const copyButtons = document.querySelectorAll('.copy-btn');
    
    copyButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const codeElement = this.closest('.partner-code')?.querySelector('.code');
            if (!codeElement) return;
            
            const code = codeElement.textContent.trim();
            const originalTitle = this.getAttribute('title');
            
            try {
                // Remove 'copied' class from all buttons first
                document.querySelectorAll('.copy-btn').forEach(btn => {
                    btn.classList.remove('copied');
                });
                
                // Try modern clipboard API first
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(code);
                } else {
                    // Fallback for older browsers
                    const textArea = document.createElement('textarea');
                    textArea.value = code;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                }
                
                // Show success feedback
                this.classList.add('copied');
                this.setAttribute('title', 'Copied!');
                
                // Reset after animation
                setTimeout(() => {
                    if (this) { // Check if element still exists
                        this.classList.remove('copied');
                        this.setAttribute('title', originalTitle);
                    }
                }, 2000);
                
            } catch (err) {
                console.error('Failed to copy text: ', err);
                // Show error feedback
                if (this) {
                    this.setAttribute('title', 'Failed to copy');
                    setTimeout(() => {
                        if (this) this.setAttribute('title', originalTitle);
                    }, 2000);
                }
            }
        });
    });

    // Add animation to partner cards on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Animate partner cards
    const cards = document.querySelectorAll('.partner-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = `opacity 0.5s ease ${index * 0.2}s, transform 0.5s ease ${index * 0.2}s`;
        observer.observe(card);
    });

    // Add hover effect to buttons
    const buttons = document.querySelectorAll('.btn:not(:disabled)');
    buttons.forEach(button => {
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 5px 15px rgba(0, 242, 255, 0.4)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = 'none';
        });
    });
});