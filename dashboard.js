// Function to show notifications
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span class="notification-message">${message}</span>
        <span class="notification-close">&times;</span>
    `;
    
    document.body.appendChild(notification);
    
    // Show notification with animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // Close button functionality
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    });
    
    // Auto close after 5 seconds
    setTimeout(() => {
        if (document.body.contains(notification)) {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }
    }, 5000);
}

document.addEventListener('DOMContentLoaded', function() {
    // Check for payment status in localStorage
    if (localStorage.getItem('payment_success')) {
        const paymentStatus = localStorage.getItem('payment_success');
        const paymentId = localStorage.getItem('payment_id');
        
        if (paymentStatus === 'true') {
            // Платеж уже подтвержден
            showNotification('✅ Платеж успешно обработан!', 'success');
            
            // Clear the flags
            localStorage.removeItem('payment_success');
            localStorage.removeItem('payment_id');
            
            // Refresh VDS servers list
            loadVDSServers();
        } else if (paymentStatus === 'pending' && paymentId) {
            // Платеж в процессе - проверяем статус
            console.log('Проверка статуса ожидающего платежа:', paymentId);
            setTimeout(() => {
                checkPaymentStatus(paymentId).then(success => {
                    if (success) {
                        // Если платеж успешен, очищаем флаги
                        localStorage.removeItem('payment_success');
                        localStorage.removeItem('payment_id');
                    }
                });
            }, 1000);
        }
    }
    
    // Also check if we have a last_payment_id and verify its status
    const lastPaymentId = localStorage.getItem('last_payment_id');
    if (lastPaymentId) {
        // Schedule a check after page loads
        setTimeout(async () => {
            const success = await checkPaymentStatus(lastPaymentId);
            if (success) {
                // Clear the last payment id
                localStorage.removeItem('last_payment_id');
            }
        }, 1000);
    }
    
    // Load user information and check admin status
    loadUserInfo();
    
    // Toggle active class for sidebar navigation
    const sidebarItems = document.querySelectorAll('.sidebar-nav ul li');
    
    sidebarItems.forEach(item => {
        item.addEventListener('click', function() {
            // Remove active class from all items
            sidebarItems.forEach(i => i.classList.remove('active'));
            
            // Add active class to clicked item
            this.classList.add('active');
        });
    });
    
    // Server control functions
    const startButtons = document.querySelectorAll('.btn-start-server');
    const stopButtons = document.querySelectorAll('.btn-stop-server');
    const restartButtons = document.querySelectorAll('.btn-restart-server');
    
    startButtons.forEach(button => {
        button.addEventListener('click', function() {
            const serverId = this.getAttribute('data-server-id');
            startServer(serverId);
        });
    });
    
    stopButtons.forEach(button => {
        button.addEventListener('click', function() {
            const serverId = this.getAttribute('data-server-id');
            stopServer(serverId);
        });
    });
    
    restartButtons.forEach(button => {
        button.addEventListener('click', function() {
            const serverId = this.getAttribute('data-server-id');
            restartServer(serverId);
        });
    });
    
    // Load user info function
    async function loadUserInfo() {
        try {
            const response = await fetch('/api/user');
            
            if (response.status === 401) {
                // Если ошибка авторизации, перенаправляем на страницу входа
                console.error('Сессия истекла или пользователь не авторизован');
                window.location.href = '/login.html?session_expired=true';
                return;
            }
            
            if (!response.ok) {
                throw new Error(`Не удалось загрузить данные пользователя: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Ошибка при получении данных пользователя');
            }
            
            // Update UI with username
            if (document.getElementById('username')) {
                document.getElementById('username').textContent = data.user.username;
            }
            
            // Check if user is admin and manage admin elements
            if (data.user.is_admin) {
                // Add admin indicator or menu
                const userInfo = document.querySelector('.user-info');
                if (userInfo) {
                    // Add admin badge
                    const adminBadge = document.createElement('span');
                    adminBadge.className = 'admin-badge';
                    adminBadge.textContent = 'Админ';
                    userInfo.appendChild(adminBadge);
                }
                
                // Show admin-only elements
                document.querySelectorAll('.admin-only').forEach(el => {
                    el.style.display = 'block';
                });
            } else {
                // Hide admin-only elements
                document.querySelectorAll('.admin-only').forEach(el => {
                    el.style.display = 'none';
                });
            }
        } catch (error) {
            console.error('Ошибка при получении данных пользователя:', error);
        }
    }
    
    // Mock server control functions
    function startServer(serverId) {
        console.log(`Starting server ${serverId}`);
        updateServerStatus(serverId, 'active');
    }
    
    function stopServer(serverId) {
        console.log(`Stopping server ${serverId}`);
        updateServerStatus(serverId, 'inactive');
    }
    
    function restartServer(serverId) {
        console.log(`Restarting server ${serverId}`);
        // Simulate restart
        updateServerStatus(serverId, 'inactive');
        
        setTimeout(() => {
            updateServerStatus(serverId, 'active');
        }, 2000);
    }
    
    function updateServerStatus(serverId, status) {
        const serverItem = document.querySelector(`.server-item[data-server-id="${serverId}"]`);
        const statusElement = serverItem.querySelector('.server-status');
        
        statusElement.classList.remove('active', 'inactive');
        statusElement.classList.add(status);
        
        statusElement.textContent = status === 'active' ? 'Online' : 'Offline';
    }
    
    // Update resource usage bars
    updateResourceBars();
    
    function updateResourceBars() {
        const cpuUsage = document.querySelector('#cpu-usage .usage-progress');
        const ramUsage = document.querySelector('#ram-usage .usage-progress');
        
        // Get current percentage values
        const cpuPercentage = parseInt(cpuUsage?.style.width) || 65;
        const ramPercentage = parseInt(ramUsage?.style.width) || 42;
        
        // Update progress bars
        if (cpuUsage) cpuUsage.style.width = `${cpuPercentage}%`;
        if (ramUsage) ramUsage.style.width = `${ramPercentage}%`;
        
        // Update usage info text
        if (document.querySelector('#cpu-usage .usage-info .used'))
            document.querySelector('#cpu-usage .usage-info .used').textContent = `${cpuPercentage}%`;
        if (document.querySelector('#ram-usage .usage-info .used'))
            document.querySelector('#ram-usage .usage-info .used').textContent = `${ramPercentage}%`;
    }
    
    // VDS сервера - получение списка и отображение
    async function loadVDSServers() {
        try {
            const response = await fetch('/api/vds/list');
            
            if (response.status === 401) {
                // Если ошибка авторизации, перенаправляем на страницу входа
                console.error('Сессия истекла или пользователь не авторизован');
                window.location.href = '/login.html?session_expired=true';
                return;
            }
            
            if (!response.ok) {
                throw new Error(`Не удалось загрузить список серверов: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.message || 'Ошибка при получении списка серверов');
            }
            
            if (data.servers && data.servers.length > 0) {
                // Sort servers by creation date (newest first)
                data.servers.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
                
                renderVDSServers(data.servers);
                document.getElementById('no-servers-message').style.display = 'none';
                
                // Check pending servers for status updates
                const pendingServers = data.servers.filter(s => s.status === 'pending');
                if (pendingServers.length > 0) {
                    // Schedule a refresh in 10 seconds to check for status updates
                    setTimeout(loadVDSServers, 10000);
                }
            } else {
                document.getElementById('no-servers-message').style.display = 'block';
            }
        } catch (error) {
            console.error('Ошибка при загрузке VDS серверов:', error);
            document.getElementById('no-servers-message').textContent = 'Ошибка при загрузке списка серверов. Попробуйте обновить страницу.';
            document.getElementById('no-servers-message').style.display = 'block';
            
            // Show an error notification
            if (typeof showNotification === 'function') {
                showNotification('Ошибка при загрузке серверов: ' + error.message, 'error');
            }
        }
    }
    
    // Рендеринг списка VDS серверов
    function renderVDSServers(servers) {
        const serverListContainer = document.getElementById('vds-server-list');
        
        // Очищаем контейнер от старых данных (кроме сообщения об отсутствии серверов)
        const noServersMessage = document.getElementById('no-servers-message');
        serverListContainer.innerHTML = '';
        serverListContainer.appendChild(noServersMessage);
        
        servers.forEach(server => {
            const serverItem = document.createElement('div');
            serverItem.className = 'server-item';
            serverItem.setAttribute('data-server-id', server.id);
            
            // Формируем название на основе плана
            const planNames = {
                'free': 'Free VDS',
                'premium': 'Premium VDS',
                'basic': 'Basic VDS',
                'standard': 'Standard VDS'
            };
            
            const planName = planNames[server.plan] || 'VDS Server';
            
            // Классы статуса и текст
            let statusClass, statusText;
            
            switch(server.status) {
                case 'active':
                    statusClass = 'active';
                    statusText = 'Онлайн';
                    break;
                case 'pending':
                    statusClass = 'pending';
                    statusText = 'Ожидает активации';
                    break;
                default:
                    statusClass = 'inactive';
                    statusText = 'Офлайн';
            }
            
            // Контент карточки сервера
            serverItem.innerHTML = `
                <div class="server-info">
                    <h4>${planName}</h4>
                    <div class="server-status ${statusClass}">${statusText}</div>
                </div>
                <div class="server-details">
                    <p>ID: ${server.id}</p>
                    <p>Создан: ${new Date(server.created_at).toLocaleDateString()}</p>
                </div>
            `;
            
            // Если сервер активен и у него есть ссылка доступа, показываем её
            if (server.status === 'active') {
                const accessSection = document.createElement('div');
                accessSection.className = 'server-access';
                
                if (server.access_link) {
                    accessSection.innerHTML = `
                        <p>Ссылка доступа:</p>
                        <a href="${server.access_link}" target="_blank" class="btn-access-link">Открыть доступ</a>
                    `;
                } else {
                    accessSection.innerHTML = `
                        <p>Ожидание ссылки доступа...</p>
                        <button class="btn-check-access" data-server-id="${server.id}">Проверить доступ</button>
                    `;
                }
                
                serverItem.appendChild(accessSection);
            } else if (server.status === 'pending') {
                // Для серверов в ожидании показываем информационное сообщение
                const pendingSection = document.createElement('div');
                pendingSection.className = 'server-pending-info';
                
                if (server.plan === 'free') {
                    pendingSection.innerHTML = `
                        <p>Ваш бесплатный сервер ожидает активации администратором.</p>
                        <p>Обычно это занимает не более 24 часов.</p>
                        <button class="btn-check-status" data-server-id="${server.id}">Проверить статус</button>
                    `;
                } else {
                    pendingSection.innerHTML = `
                        <p>Сервер ожидает подтверждения оплаты и активации.</p>
                        <p>После оплаты активация производится администратором вручную.</p>
                        <button class="btn-check-status" data-server-id="${server.id}">Проверить статус</button>
                    `;
                }
                
                serverItem.appendChild(pendingSection);
            }
            
            // Добавляем в контейнер
            serverListContainer.appendChild(serverItem);
        });
        
        // Привязка событий к кнопкам проверки доступа
        const checkAccessButtons = document.querySelectorAll('.btn-check-access, .btn-check-status');
        checkAccessButtons.forEach(button => {
            button.addEventListener('click', async function() {
                const serverId = this.getAttribute('data-server-id');
                // Перезагружаем список серверов, чтобы получить актуальный статус
                await loadVDSServers();
                showNotification('Статус сервера обновлен', 'info');
            });
        });
    }
    
    // Проверка наличия ссылки доступа для VDS
    async function checkVDSAccess(serverId) {
        try {
            const response = await fetch(`/api/vds/${serverId}/access`);
            
            if (!response.ok) {
                throw new Error('Не удалось получить данные о доступе');
            }
            
            const data = await response.json();
            
            if (data.success && data.access_link) {
                // Обновляем UI, если ссылка появилась
                const serverItem = document.querySelector(`.server-item[data-server-id="${serverId}"]`);
                const accessSection = serverItem.querySelector('.server-access');
                
                accessSection.innerHTML = `
                    <p>Ссылка доступа:</p>
                    <a href="${data.access_link}" target="_blank" class="btn-access-link">Открыть доступ</a>
                `;
            } else {
                // Показываем сообщение, что ссылки пока нет
                alert('Ссылка доступа еще не предоставлена. Пожалуйста, попробуйте позже.');
            }
        } catch (error) {
            console.error('Ошибка при проверке доступа:', error);
            alert('Произошла ошибка при проверке доступа: ' + error.message);
        }
    }
    
    // Обработка заказа VDS
    const orderVDSButtons = document.querySelectorAll('.btn-order-vds');
    orderVDSButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const plan = this.getAttribute('data-plan');
            showPaymentMethodModal(plan);
        });
    });
    
    // Функция для отображения модального окна выбора способа оплаты
    function showPaymentMethodModal(plan) {
        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.className = 'modal payment-method-modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Выберите способ оплаты</h3>
                    <span class="close-modal">&times;</span>
                </div>
                <div class="modal-body">
                    <div class="payment-methods">
                        <div class="payment-method selected" data-method="yoomoney">
                            <img src="https://yoomoney.ru/i/html-letters/header-logo.png" alt="YooMoney" height="30">
                            <p>Банковская карта или ЮMoney</p>
                        </div>
                    </div>
                    <div class="selected-plan-info">
                        <p>Выбранный план: <strong>${plan.toUpperCase()}</strong></p>
                        <p>Стоимость: <strong>${getPlanPrice(plan)} ₽/мес</strong></p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-order" id="btn-order-vds">Оплатить</button>
                </div>
            </div>
        `;
        
        // Добавляем модальное окно в DOM
        document.body.appendChild(modal);
        
        // Отображаем модальное окно
        setTimeout(() => {
            modal.style.display = 'flex';
            modal.classList.add('active');
        }, 50);
        
        // Обработчик закрытия модального окна
        const closeButton = modal.querySelector('.close-modal');
        closeButton.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
                modal.remove();
            }, 300);
        });
        
        // Обработчик кнопки заказа VDS
        const orderButton = document.getElementById('btn-order-vds');
        orderButton.addEventListener('click', () => {
            // Получение выбранного способа оплаты
            const selectedMethod = document.querySelector('.payment-method.selected').dataset.method;
            
            // Оформление заказа
            orderVDS(plan, selectedMethod);
            
            // Закрытие модального окна
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
                modal.remove();
            }, 300);
        });
    }
    
    // Функция для получения цены плана
    function getPlanPrice(plan) {
        switch(plan) {
            case 'free': return 0;
            case 'premium': return 449;
            default: return 0;
        }
    }
    
    // Функция для создания заказа VDS
    async function orderVDS(plan, paymentMethod = 'yoomoney') {
        try {
            showLoadingModal('Создание заказа...');
            
            // Отправка запроса на сервер для создания заказа VDS
            const response = await fetch('/api/vds/order', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    plan: plan,
                    payment_method: paymentMethod
                })
            });
            
            const data = await response.json();
            console.log('Ответ сервера на создание заказа:', data);
            
            // Закрыть модальное окно загрузки
            closeAllModals();
            
            if (data.success) {
                // Сохраняем ID VDS в localStorage для дальнейшего использования
                localStorage.setItem('currentVdsId', data.vds_id);
                
                // Если это бесплатный тариф, показываем специальное сообщение
                if (plan === 'free') {
                    showNotification('✅ Бесплатный VDS успешно создан!', 'success');
                    // Обновляем список серверов
                    loadVDSServers();
                    return data;
                }
                
                // Для платных тарифов проверяем URL оплаты
                if (!data.redirect_url || !data.redirect_url.startsWith('http')) {
                    showNotification('⚠️ Получен некорректный URL для оплаты. Попробуйте вручную.', 'error');
                    console.error('Некорректный URL для оплаты:', data.redirect_url);
                }
                
                // Показать информацию о заказе и предложить перейти на страницу оплаты
                showVDSPaymentConfirmModal(
                    data.vds_id,
                    data.redirect_url,
                    data.verification_code,
                    paymentMethod
                );
                
                return data;
            } else {
                // Показываем сообщение об ошибке
                showNotification(data.message || 'Произошла ошибка при создании заказа.', 'error');
                return null;
            }
        } catch (error) {
            console.error('Ошибка при создании заказа:', error);
            closeAllModals();
            showNotification('Произошла ошибка при создании заказа: ' + error.message, 'error');
            return null;
        }
    }
    
    // Функция для проверки статуса платежа
    async function checkPaymentStatus(paymentId) {
        try {
            showLoadingModal('Проверка статуса платежа...');
            
            const response = await fetch(`/api/payments/${paymentId}/status`);
            
            if (!response.ok) {
                throw new Error(`Ошибка при проверке статуса: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            closeAllModals();
            
            if (data.success) {
                if (data.status === 'PAID') {
                    showNotification('✅ Платеж успешно проведен!', 'success');
                    
                    // Обновляем список серверов
                    loadVDSServers();
                    return true;
                } else if (data.status === 'WAITING') {
                    showNotification('⏳ Ожидание подтверждения платежа...', 'info');
                    
                    // Автоматически проверяем статус снова через 5 секунд
                    setTimeout(() => checkPaymentStatus(paymentId), 5000);
                    return false;
                } else if (data.status === 'FAILED') {
                    showNotification('❌ Платеж не прошел или отменен', 'error');
                    return false;
                }
            } else {
                showNotification(data.message || 'Ошибка при проверке статуса платежа', 'error');
                return false;
            }
        } catch (error) {
            console.error('Ошибка при проверке статуса платежа:', error);
            closeAllModals();
            showNotification('Ошибка при проверке статуса платежа: ' + error.message, 'error');
            return false;
        }
    }
    
    // Модифицируем функцию для отображения модального окна подтверждения заказа VDS
    function showVDSPaymentConfirmModal(vdsId, redirectUrl, verificationCode, paymentMethod) {
        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.className = 'modal payment-confirm-modal';
        
        // Определяем название платежной системы
        const paymentSystemName = paymentMethod === 'webmoney' ? 'WebMoney' : 'ЮMoney';
        
        // Сохраняем информацию о платеже
        const paymentId = redirectUrl.split('label=')[1]?.split('&')[0] || null;
        if (paymentId) {
            localStorage.setItem('last_payment_id', paymentId);
        }
        
        // Содержимое модального окна
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Заказ VDS сервера создан</h3>
                    <span class="close-modal">&times;</span>
                </div>
                <div class="modal-body">
                    <p>Номер заказа: <strong>#${vdsId}</strong></p>
                    <p>Способ оплаты: <strong>${paymentSystemName}</strong></p>
                    <p>Для активации сервера, перейдите на страницу оплаты.</p>
                    
                    <div class="payment-code">
                        <p>Ваш код верификации платежа:</p>
                        <div class="verification-code">${verificationCode}</div>
                        <p class="verification-note">Сохраните этот код! Он может понадобиться для подтверждения платежа.</p>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-proceed-payment" id="proceed-to-payment">Перейти к оплате</button>
                    ${paymentId ? `<button class="btn-check-payment" id="check-payment-status" data-payment="${paymentId}">Проверить статус</button>` : ''}
                    <a href="payment-manual.html?id=${vdsId}&code=${verificationCode}" class="btn-manual-payment" target="_blank">Ручная оплата</a>
                </div>
            </div>
        `;
        
        // Добавляем модальное окно в DOM
        document.body.appendChild(modal);
        
        // Отображаем модальное окно
        setTimeout(() => {
            modal.style.display = 'flex';
            modal.classList.add('active');
        }, 50);
        
        // Обработчик закрытия модального окна
        const closeButton = modal.querySelector('.close-modal');
        closeButton.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
                modal.remove();
                
                // Обновляем список серверов
                loadVDSServers();
            }, 300);
        });
        
        // Обработчик кнопки для перехода к оплате
        const proceedButton = document.getElementById('proceed-to-payment');
        proceedButton.addEventListener('click', () => {
            try {
                console.log('Открытие ссылки для оплаты:', redirectUrl);
                
                // Проверка валидности URL
                if (!redirectUrl || !redirectUrl.startsWith('http')) {
                    throw new Error('Некорректный URL для оплаты: ' + redirectUrl);
                }
                
                // Пробуем открыть в новом окне
                const newWindow = window.open(redirectUrl, '_blank');
                
                // Проверяем, открылось ли окно
                if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                    // Если не открылось, выводим сообщение и создаем ссылку
                    showNotification('⚠️ Браузер заблокировал открытие окна. Нажмите на ссылку ниже', 'error');
                    
                    // Создаем элемент с ссылкой
                    const linkContainer = document.createElement('div');
                    linkContainer.style.marginTop = '15px';
                    linkContainer.style.textAlign = 'center';
                    linkContainer.innerHTML = `<a href="${redirectUrl}" target="_blank" class="payment-direct-link">Нажмите здесь для перехода к оплате</a>`;
                    
                    // Добавляем в модальное окно
                    const modalBody = modal.querySelector('.modal-body');
                    modalBody.appendChild(linkContainer);
                }
            } catch (error) {
                console.error('Ошибка при открытии платежной ссылки:', error);
                showNotification('❌ Ошибка при открытии страницы оплаты', 'error');
                
                // Показываем ссылку в любом случае
                const linkContainer = document.createElement('div');
                linkContainer.style.marginTop = '15px';
                linkContainer.style.textAlign = 'center';
                linkContainer.innerHTML = `<a href="${redirectUrl}" target="_blank" class="payment-direct-link">Нажмите здесь для перехода к оплате</a>`;
                
                const modalBody = modal.querySelector('.modal-body');
                modalBody.appendChild(linkContainer);
            }
        });
        
        // Обработчик кнопки проверки статуса
        const checkStatusButton = document.getElementById('check-payment-status');
        if (checkStatusButton) {
            checkStatusButton.addEventListener('click', async () => {
                const paymentId = checkStatusButton.getAttribute('data-payment');
                if (paymentId) {
                    const successful = await checkPaymentStatus(paymentId);
                    if (successful) {
                        // Если платеж успешен, закрываем модальное окно
                        modal.classList.remove('active');
                        setTimeout(() => {
                            modal.style.display = 'none';
                            modal.remove();
                        }, 300);
                    }
                }
            });
        }
    }
    
    // Функция для отображения модального окна с информацией о платеже
    function showPaymentConfirmModal(amount, redirectUrl) {
        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.className = 'modal payment-confirm-modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Платеж создан</h3>
                    <span class="close-modal">&times;</span>
                </div>
                <div class="modal-body">
                    <p>Сумма к оплате: <strong>${amount} ₽</strong></p>
                    <p>Для завершения оплаты, перейдите на страницу платежной системы</p>
                </div>
                <div class="modal-footer">
                    <button class="btn-proceed-payment" id="proceed-to-payment">Перейти к оплате</button>
                </div>
            </div>
        `;
        
        // Добавляем модальное окно в DOM
        document.body.appendChild(modal);
        
        // Отображаем модальное окно
        setTimeout(() => {
            modal.style.display = 'flex';
            modal.classList.add('active');
        }, 50);
        
        // Обработчик закрытия модального окна
        const closeButton = modal.querySelector('.close-modal');
        closeButton.addEventListener('click', () => {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
                modal.remove();
            }, 300);
        });
        
        // Обработчик кнопки для перехода к оплате
        const proceedButton = document.getElementById('proceed-to-payment');
        proceedButton.addEventListener('click', () => {
            window.open(redirectUrl, '_blank');
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
                modal.remove();
            }, 300);
        });
    }
    
    // Mobile menu toggle
    const mobileMenuToggle = document.querySelector('#mobile-menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    
    if (mobileMenuToggle) {
        mobileMenuToggle.addEventListener('click', function() {
            sidebar.classList.toggle('show');
        });
    }
    
    // Загружаем VDS серверы при переключении на вкладку "Серверы"
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            if (tabId === 'servers') {
                loadVDSServers();
            }
        });
    });
    
    // Обработка формы пополнения баланса
    const paymentForm = document.getElementById('payment-form');
    if (paymentForm) {
        paymentForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const amount = document.getElementById('amount').value;
            
            if (amount < 100) {
                alert('Минимальная сумма пополнения 100 ₽');
                return;
            }
            
            initiateYooMoneyPayment(amount);
        });
    }
    
    // Функция для отправки запроса на создание платежа YooMoney
    async function initiateYooMoneyPayment(amount) {
        try {
            showLoadingModal(`Создание платежа на сумму ${amount} ₽...`);
            
            // Отправка запроса на сервер для создания платежа
            const response = await fetch('/api/payments/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Ошибка при создании платежа');
            }
            
            // Закрыть модальное окно загрузки
            closeAllModals();
            
            // Показать информацию о платеже и предложить перейти на страницу оплаты
            showPaymentConfirmModal(amount, data.confirmation_url);
        } catch (error) {
            console.error('Ошибка при создании платежа:', error);
            closeAllModals();
            alert('Произошла ошибка при создании платежа: ' + error.message);
        }
    }
    
    // Функция для отображения модального окна загрузки
    function showLoadingModal(message) {
        // Закрыть предыдущие модальные окна, если они есть
        closeAllModals();
        
        // Создаем модальное окно
        const modal = document.createElement('div');
        modal.className = 'modal loading-modal';
        
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Обработка...</h3>
                </div>
                <div class="modal-body">
                    <p>${message}</p>
                    <div class="loader"></div>
                </div>
            </div>
        `;
        
        // Добавляем модальное окно в DOM
        document.body.appendChild(modal);
        
        // Отображаем модальное окно
        setTimeout(() => {
            modal.style.display = 'flex';
            modal.classList.add('active');
        }, 50);
    }
    
    // Функция для закрытия всех модальных окон
    function closeAllModals() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (document.body.contains(modal)) {
                modal.classList.remove('active');
                setTimeout(() => {
                    modal.style.display = 'none';
                    modal.remove();
                }, 300);
            }
        });
    }
    
    // Добавляем функцию для проверки параметров URL и обработки ошибок
    function checkVdsIdInUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const vdsId = urlParams.get('id');
        
        // Если ID не указан в URL, но есть в localStorage
        if (!vdsId && localStorage.getItem('currentVdsId')) {
            // Добавляем параметр id в URL
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('id', localStorage.getItem('currentVdsId'));
            
            // Обновляем URL без перезагрузки страницы
            window.history.replaceState({}, '', newUrl);
            return true;
        }
        
        // Если ID отсутствует и в URL, и в localStorage
        if (!vdsId && !localStorage.getItem('currentVdsId')) {
            // Показываем модальное окно с ошибкой
            const modal = document.createElement('div');
            modal.className = 'modal error-modal';
            
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>Подтвердите действие на ${window.location.host}</h3>
                    </div>
                    <div class="modal-body">
                        <p>ID VDS не указан в URL. Вернитесь в личный кабинет и повторите попытку.</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-ok" id="btn-error-ok">OK</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            setTimeout(() => {
                modal.style.display = 'flex';
                modal.classList.add('active');
            }, 50);
            
            const okButton = document.getElementById('btn-error-ok');
            okButton.addEventListener('click', () => {
                window.location.href = 'dashboard.html';
            });
            
            return false;
        }
        
        return true;
    }
    
    // Проверяем наличие ID VDS в URL (если мы на странице, где это требуется)
    if (window.location.pathname.includes('payment') || 
        window.location.pathname.includes('confirm')) {
        checkVdsIdInUrl();
    }
}); 