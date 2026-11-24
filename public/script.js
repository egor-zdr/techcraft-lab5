document.addEventListener('DOMContentLoaded', () => {
    const componentsGrid = document.getElementById('components-grid');
    const addComponentForm = document.getElementById('add-component-form');
    const orderForm = document.getElementById('order-form');
    const ordersList = document.getElementById('orders-list');
    const modal = document.getElementById('product-modal');
    const closeModalBtn = document.querySelector('.modal-close');

    let cart = [];

    // 1. Завантаження комплектуючих із REST API (GET /api/components)
    async function loadComponents() {
        try {
            const response = await fetch('/api/components');
            if (!response.ok) throw new Error('Помилка завантаження даних');
            const components = await response.json();
            renderComponents(components);
        } catch (error) {
            componentsGrid.innerHTML = `<p style="color: #e74c3c;">Не вдалося завантажити каталог: ${error.message}</p>`;
        }
    }

    function renderComponents(components) {
        if (components.length === 0) {
            componentsGrid.innerHTML = '<p style="color: #94a3b8;">Комплектуючих поки немає. Додайте перший товар вище!</p>';
            return;
        }

        componentsGrid.innerHTML = components.map(item => `
            <article class="card" data-id="${item.id}">
                <div class="card__badge">${escapeHTML(item.category)}</div>
                <h3 class="card__title">${escapeHTML(item.title)}</h3>
                <p class="card__desc">${escapeHTML(item.description)}</p>
                <div class="card__footer">
                    <span class="card__price">${item.price.toLocaleString('uk-UA')} ₴</span>
                    <div class="card__actions">
                        <button class="btn btn--small buy-btn" data-title="${escapeHTML(item.title)}" data-price="${item.price}">Додати</button>
                        <button class="btn btn--small btn--edit edit-btn" data-id="${item.id}" data-title="${escapeHTML(item.title)}" data-price="${item.price}" title="Змінити ціну">✎</button>
                        <button class="btn btn--small btn--danger delete-btn" data-id="${item.id}" title="Видалити">✕</button>
                    </div>
                </div>
            </article>
        `).join('');

        attachCardListeners();
    }

    // Прив'язка подій до кнопок на картках
    function attachCardListeners() {
        // Додавання в кошик
        document.querySelectorAll('.buy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const title = btn.dataset.title;
                const price = Number(btn.dataset.price);
                cart.push({ title, price });
                updateCartUI();

                const modalTitle = document.getElementById('modal-title');
                if (modalTitle) modalTitle.textContent = `Товар "${title}" додано до кошика!`;
                if (modal) modal.style.display = 'flex';
            });
        });

        // Оновлення компонента (PUT /api/components/:id)
        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const currentTitle = btn.dataset.title;
                const currentPrice = btn.dataset.price;

                const newTitle = prompt('Введіть нову назву товару:', currentTitle);
                if (!newTitle) return;
                const newPrice = prompt('Введіть нову ціну (₴):', currentPrice);
                if (!newPrice || isNaN(Number(newPrice)) || Number(newPrice) <= 0) {
                    alert('Некоректна ціна!');
                    return;
                }

                try {
                    const res = await fetch(`/api/components/${id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ title: newTitle, price: Number(newPrice) })
                    });
                    if (!res.ok) throw new Error('Помилка оновлення');
                    await loadComponents();
                } catch (err) {
                    alert(err.message);
                }
            });
        });

        // Видалення компонента (DELETE /api/components/:id)
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                if (!confirm('Видалити цей компонент із бази даних?')) return;

                try {
                    const res = await fetch(`/api/components/${id}`, { method: 'DELETE' });
                    if (!res.ok) throw new Error('Помилка видалення');
                    await loadComponents();
                } catch (err) {
                    alert(err.message);
                }
            });
        });
    }

    // 2. Створення нового компонента (POST /api/components)
    if (addComponentForm) {
        addComponentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const category = document.getElementById('comp-category').value;
            const title = document.getElementById('comp-title').value;
            const description = document.getElementById('comp-desc').value;
            const price = Number(document.getElementById('comp-price').value);

            try {
                const res = await fetch('/api/components', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ category, title, description, price })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Помилка створення');

                addComponentForm.reset();
                await loadComponents();
            } catch (err) {
                alert(err.message);
            }
        });
    }

    // 3. Відправка заявки на сервер (POST /api/orders)
    if (orderForm) {
        orderForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearErrors();

            const nameInput = document.getElementById('user-name');
            const emailInput = document.getElementById('user-email');
            const phoneInput = document.getElementById('user-phone');
            let isValid = true;

            if (!nameInput.value.trim() || nameInput.value.trim().length < 2) {
                showError(nameInput, 'Введіть ім\'я (не менше 2 символів)');
                isValid = false;
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailInput.value.trim())) {
                showError(emailInput, 'Введіть коректний Email');
                isValid = false;
            }
            const phoneRegex = /^\+?[0-9]{10,12}$/;
            if (!phoneRegex.test(phoneInput.value.trim().replace(/\s+/g, ''))) {
                showError(phoneInput, 'Введіть коректний номер телефону (+380...)');
                isValid = false;
            }

            if (!isValid) return;

            const selectedItems = cart.length > 0
                ? cart.map(i => `${i.title} (${i.price} ₴)`).join(', ')
                : 'Консультація щодо збірки';

            try {
                const res = await fetch('/api/orders', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        user_name: nameInput.value.trim(),
                        user_email: emailInput.value.trim(),
                        user_phone: phoneInput.value.trim(),
                        selected_items: selectedItems
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Помилка відправки заявки');

                alert('Дякуємо! Заявку збережено в базі даних.');
                orderForm.reset();
                cart = [];
                updateCartUI();
                await loadOrders();
            } catch (err) {
                alert(err.message);
            }
        });
    }

    // 4. Завантаження списку заявок (GET /api/orders)
    async function loadOrders() {
        try {
            const res = await fetch('/api/orders');
            const orders = await res.json();
            ordersList.innerHTML = orders.length === 0
                ? '<p style="text-align:center; color:#94a3b8;">Заявок поки немає.</p>'
                : orders.map(o => `
                    <div class="order-item">
                        <strong>#${o.id} — ${escapeHTML(o.user_name)}</strong> (${escapeHTML(o.user_phone)})<br>
                        <span style="color:#94a3b8;">Склад: ${escapeHTML(o.selected_items)}</span>
                    </div>
                `).join('');
        } catch (err) {
            console.error(err);
        }
    }

    function updateCartUI() {
        document.getElementById('cart-count').textContent = cart.length;
        const total = cart.reduce((sum, item) => sum + item.price, 0);
        document.getElementById('cart-total').textContent = total.toLocaleString('uk-UA');
    }

    function escapeHTML(str) {
        return String(str).replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[m]));
    }

    function showError(inputElement, message) {
        inputElement.classList.add('input-error');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.style.color = '#e74c3c';
        errorDiv.style.fontSize = '12px';
        errorDiv.style.marginTop = '4px';
        errorDiv.textContent = message;
        inputElement.parentNode.appendChild(errorDiv);
    }

    function clearErrors() {
        document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
        document.querySelectorAll('.error-message').forEach(el => el.remove());
    }

    if (closeModalBtn && modal) {
        closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
        window.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
    }

    // Старт
    loadComponents();
    loadOrders();
});