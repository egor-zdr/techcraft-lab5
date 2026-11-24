require('dotenv').config();
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const helmet = require('helmet');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_FILE || './techcraft.db';

// Базова безпека HTTP-заголовків
app.use(helmet({
    contentSecurityPolicy: false
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Підключення до бази даних SQLite
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('Помилка підключення до БД:', err.message);
    } else {
        console.log('Успішно підключено до бази даних SQLite.');
        initDatabase();
    }
});

// Ініціалізація таблиць та стартових товарів
function initDatabase() {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS components (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                category TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                price INTEGER NOT NULL
            )
        `);

        db.run(`
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_name TEXT NOT NULL,
                user_email TEXT NOT NULL,
                user_phone TEXT NOT NULL,
                selected_items TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Заповнюємо початковими товарами, якщо таблиця порожня
        db.get('SELECT COUNT(*) AS count FROM components', (err, row) => {
            if (!err && row.count === 0) {
                const stmt = db.prepare('INSERT INTO components (category, title, description, price) VALUES (?, ?, ?, ?)');
                stmt.run('CPU', 'AMD Ryzen 5 5600X', '6 ядер / 12 потоків, 3.7 - 4.6 GHz, Socket AM4', 6200);
                stmt.run('GPU', 'MSI RX 5700 OC', '8 GB GDDR6, 256-bit, PCIe 4.0', 8500);
                stmt.run('RAM', 'GoodRAM IRDM X DDR4', '16 GB (2x8GB), 3200 MHz, CL16', 1800);
                stmt.finalize();
                console.log('Стартові комплектуючі додано до бази даних.');
            }
        });
    });
}

// ================= REST API: КОМПЛЕКТУЮЧІ (CRUD) =================

// READ: Отримати всі комплектуючі
app.get('/api/components', (req, res) => {
    db.all('SELECT * FROM components ORDER BY id ASC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Помилка читання бази даних' });
        res.json(rows);
    });
});

// CREATE: Додати новий компонент
app.post('/api/components', (req, res) => {
    const { category, title, description, price } = req.body;
    if (!category || !title || !description || isNaN(Number(price)) || Number(price) <= 0) {
        return res.status(400).json({ error: 'Некоректні вхідні дані компонента' });
    }

    const sql = 'INSERT INTO components (category, title, description, price) VALUES (?, ?, ?, ?)';
    db.run(sql, [category.trim(), title.trim(), description.trim(), Number(price)], function (err) {
        if (err) return res.status(500).json({ error: 'Не вдалося додати компонент' });
        res.status(201).json({
            id: this.lastID,
            category: category.trim(),
            title: title.trim(),
            description: description.trim(),
            price: Number(price)
        });
    });
});

// UPDATE: Оновити ціну або назву компонента
app.put('/api/components/:id', (req, res) => {
    const { id } = req.params;
    const { title, price } = req.body;

    if (!title || isNaN(Number(price)) || Number(price) <= 0) {
        return res.status(400).json({ error: 'Вкажіть коректну назву та ціну' });
    }

    const sql = 'UPDATE components SET title = ?, price = ? WHERE id = ?';
    db.run(sql, [title.trim(), Number(price), id], function (err) {
        if (err) return res.status(500).json({ error: 'Помилка оновлення запису' });
        if (this.changes === 0) return res.status(404).json({ error: 'Компонент не знайдено' });
        res.json({ message: 'Компонент успішно оновлено' });
    });
});

// DELETE: Видалити компонент
app.delete('/api/components/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM components WHERE id = ?', [id], function (err) {
        if (err) return res.status(500).json({ error: 'Помилка видалення запису' });
        if (this.changes === 0) return res.status(404).json({ error: 'Компонент не знайдено' });
        res.json({ message: 'Компонент видалено' });
    });
});

// ================= REST API: ЗАМОВЛЕННЯ =================

// READ: Отримати всі заявки
app.get('/api/orders', (req, res) => {
    db.all('SELECT * FROM orders ORDER BY created_at DESC', [], (err, rows) => {
        if (err) return res.status(500).json({ error: 'Помилка отримання заявок' });
        res.json(rows);
    });
});

// CREATE: Створити нову заявку
app.post('/api/orders', (req, res) => {
    const { user_name, user_email, user_phone, selected_items } = req.body;

    if (!user_name || user_name.trim().length < 2) {
        return res.status(400).json({ error: 'Некоректне ім’я' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!user_email || !emailRegex.test(user_email.trim())) {
        return res.status(400).json({ error: 'Некоректний Email' });
    }
    const phoneRegex = /^\+?[0-9]{10,12}$/;
    if (!user_phone || !phoneRegex.test(user_phone.trim().replace(/\s+/g, ''))) {
        return res.status(400).json({ error: 'Некоректний номер телефону' });
    }

    const sql = 'INSERT INTO orders (user_name, user_email, user_phone, selected_items) VALUES (?, ?, ?, ?)';
    db.run(sql, [user_name.trim(), user_email.trim(), user_phone.trim(), selected_items || 'Не обрано'], function (err) {
        if (err) return res.status(500).json({ error: 'Помилка збереження заявки' });
        res.status(201).json({
            id: this.lastID,
            message: 'Заявку збережено в базі даних!'
        });
    });
});

app.listen(PORT, () => {
    console.log(`Сервер TechCraft запущено на http://localhost:${PORT}`);
});