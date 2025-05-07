document.addEventListener('DOMContentLoaded', function() {
    // Мобильное меню
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mobileMenu = document.querySelector('.mobile-menu');
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            mobileMenu.classList.toggle('active');
        });
    }
    
    // Закрытие мобильного меню при клике на ссылку
    const mobileLinks = document.querySelectorAll('.mobile-menu a');
    
    mobileLinks.forEach(link => {
        link.addEventListener('click', function() {
            mobileMenu.classList.remove('active');
        });
    });
    
    // Плавная прокрутка к секциям
    const smoothScrollLinks = document.querySelectorAll('a[href^="#"]');
    
    smoothScrollLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            
            if (targetElement) {
                window.scrollTo({
                    top: targetElement.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });
    
    // Обработчики для кнопок входа и регистрации
    const loginButton = document.querySelector('.btn-login');
    const registerButton = document.querySelector('.btn-register');
    
    if (loginButton) {
        loginButton.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'login.html';
        });
    }
    
    if (registerButton) {
        registerButton.addEventListener('click', function(e) {
            e.preventDefault();
            window.location.href = 'register.html';
        });
    }
    
    // Закрытие мобильного меню при клике на ссылку
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (mobileMenu.classList.contains('active')) {
                mobileMenu.classList.remove('active');
            }
        });
    });
    
    // Плавная прокрутка для якорных ссылок
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            if (this.getAttribute('href') !== '#') {
                e.preventDefault();
                
                const targetId = this.getAttribute('href');
                const targetElement = document.querySelector(targetId);
                
                if (targetElement) {
                    const headerHeight = document.querySelector('header').offsetHeight;
                    const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - headerHeight;
                    
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            }
        });
    });
    
    // Анимация элементов при прокрутке
    const animateElements = document.querySelectorAll('.feature-card, .testimonial-card, .pricing-card');
    
    const animateOnScroll = function() {
        const triggerBottom = window.innerHeight * 0.9;
        
        animateElements.forEach(element => {
            const elementTop = element.getBoundingClientRect().top;
            
            if (elementTop < triggerBottom) {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }
        });
    };
    
    // Инициализация стилей для анимации
    animateElements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    });
    
    // Анимация заголовков и текста в hero-секции
    const heroElements = document.querySelectorAll('#hero h1, #hero p, .hero-buttons');
    
    heroElements.forEach((element, index) => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        
        setTimeout(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateY(0)';
        }, 300 + (index * 200));
    });
    
    // Запустить анимацию для элементов в видимой области при загрузке
    setTimeout(animateOnScroll, 300);
    
    // Слушатель для анимации при скролле
    window.addEventListener('scroll', animateOnScroll);
    
    // Активное состояние для ссылок навигации при скролле
    const sections = document.querySelectorAll('section[id]');
    
    function highlightNavOnScroll() {
        const scrollPosition = window.scrollY + document.querySelector('header').offsetHeight;
        
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            const sectionHeight = section.offsetHeight;
            const sectionId = section.getAttribute('id');
            const navLink = document.querySelector(`nav a[href="#${sectionId}"]`);
            
            if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight && navLink) {
                document.querySelectorAll('nav a').forEach(link => {
                    link.style.color = '';
                });
                navLink.style.color = 'var(--text)';
            }
        });
    }
    
    window.addEventListener('scroll', highlightNavOnScroll);
    
    // Фиксация шапки при скролле с изменением стиля
    const header = document.querySelector('header');
    const originalPadding = window.getComputedStyle(header).padding;
    
    function adjustHeaderOnScroll() {
        if (window.scrollY > 50) {
            header.style.padding = '0.8rem 0';
            header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        } else {
            header.style.padding = originalPadding;
            header.style.boxShadow = 'none';
        }
    }
    
    window.addEventListener('scroll', adjustHeaderOnScroll);
    
    // Анимация при прокрутке
    const scrollElements = document.querySelectorAll('.scroll-reveal');
    
    const elementInView = (el, offset = 0) => {
        const elementTop = el.getBoundingClientRect().top;
        return (
            elementTop <= (window.innerHeight || document.documentElement.clientHeight) * (1 - offset)
        );
    };
    
    const displayScrollElement = (element) => {
        element.classList.add('scrolled');
    };
    
    const hideScrollElement = (element) => {
        element.classList.remove('scrolled');
    };
    
    const handleScrollAnimation = () => {
        scrollElements.forEach((el) => {
            if (elementInView(el, 0.25)) {
                displayScrollElement(el);
            } else {
                hideScrollElement(el);
            }
        });
    };
    
    window.addEventListener('scroll', () => {
        handleScrollAnimation();
    });
    
    // Запускаем проверку сразу после загрузки страницы
    handleScrollAnimation();
}); 