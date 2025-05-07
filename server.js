const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios'); // Для HTTP запросов
const crypto = require('crypto'); // Для подписи webhook

// Настройки для платежей
const YOOMONEY_WALLET = '4100118216611987'; // Замените на номер вашего личного кошелька YooMoney
const YOOMONEY_SECRET_KEY = '+F13iyfexJPxyV2OhcqmPizC'; // Замените на ваш секретный ключ для проверки подписи
// const WEBMONEY_PURSE = 'Z549692842691'; // Замените на номер вашего WMZ-кошелька
// const WEBMONEY_SECRET_KEY = crypto.createHash('md5').update(WEBMONEY_PURSE + 'nettyhost_salt').digest('hex'); // Генерируем ключ на основе кошелька

// QIWI настройки
// const QIWI_WALLET = '79001234567'; // Замените на ваш номер QIWI кошелька
// const QIWI_SECRET_KEY = 'eyJ2ZXJzaW9uIjoiUDJQIiwiZGF0YSI6eyJwYXlpbl9tZXJjaGFudF9zaXRlX3VpZCI6InlvdXItc2l0ZS1pZCIsInVzZXJfaWQiOiI3OTAwMTIzNDU2NyIsInNlY3JldCI6ImV4YW1wbGUtc2VjcmV0LWtleSJ9fQ=='; // Замените на ваш секретный ключ P2P API

// Payeer настройки
// const PAYEER_ACCOUNT = 'P1234567'; // Замените на номер вашего аккаунта Payeer
// const PAYEER_API_ID = '12345678'; // Замените на ID вашего API
// const PAYEER_API_KEY = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'; // Замените на секретный ключ API
// const PAYEER_SHOP_ID = '987654321'; // Замените на ID вашего магазина
// const PAYEER_SHOP_SECRET = 'SecretKey123'; // Замените на секретный ключ магазина

// RoboKassa настройки
// const ROBOKASSA_SHOP_LOGIN = 'nettyhost'; // Замените на ваш логин магазина
// const ROBOKASSA_SHOP_PASSWORD1 = 'password1'; // Замените на пароль №1 (для формирования подписи)
// const ROBOKASSA_SHOP_PASSWORD2 = 'password2'; // Замените на пароль №2 (для проверки уведомления)
// const ROBOKASSA_TEST_MODE = 1; // 0 - боевой режим, 1 - тестовый режим

// Telegram bot token - замените на ваш токен
const TELEGRAM_BOT_TOKEN = '7763700239:AAFyT-ZkcQ9LLnlAK5NM5aXA4-CYBvkLlwg';
const TELEGRAM_PAYMENT_TOKEN = 'YOUR_PAYMENT_TOKEN'; // Получите у @BotFather при включении платежей
// ID пользователей Telegram для уведомлений
const ADMIN_CHAT_IDS = ['8134425598']; // Оставляем только одного администратора

// Инициализация бота
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });

// Логирование ошибок и успешного запуска бота
bot.on('polling_error', (error) => {
  console.error('Ошибка Telegram бота:', error);
});

bot.getMe().then((info) => {
  console.log(`Telegram бот успешно запущен: @${info.username}`);
}).catch((error) => {
  console.error('Не удалось получить информацию о боте:', error);
});

const app = express();
const port = 3000;

// Настройка базы данных
const db = new sqlite3.Database('./users.db');

// Создание таблицы пользователей, если её нет
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      email TEXT UNIQUE,
      password TEXT
    )
  `);
  
  // Создание таблицы для платежей
  db.run(`
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      amount REAL,
      payment_id TEXT,
      status TEXT,
      verification_code TEXT,
      transaction_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )
  `);

  // Создание таблицы для VDS серверов
  db.run(`
    CREATE TABLE IF NOT EXISTS vds_servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      plan TEXT,
      status TEXT,
      payment_id INTEGER,
      access_link TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id),
      FOREIGN KEY (payment_id) REFERENCES payments (id)
    )
  `);
  
  // Проверка и добавление столбца verification_code, если его нет
  db.all("PRAGMA table_info(payments)", (err, rows) => {
    if (err) {
      console.error("Ошибка при проверке структуры таблицы payments:", err);
      return;
    }
    
    console.log("Структура таблицы payments:", rows);
    
    // Проверяем, есть ли столбец verification_code
    const hasVerificationCode = rows.some(row => row.name === 'verification_code');
    
    if (!hasVerificationCode) {
      console.log("Добавление столбца verification_code в таблицу payments...");
      db.run("ALTER TABLE payments ADD COLUMN verification_code TEXT", (err) => {
        if (err) {
          console.error("Ошибка при добавлении столбца verification_code:", err);
        } else {
          console.log("Столбец verification_code успешно добавлен в таблицу payments");
        }
      });
    } else {
      console.log("Столбец verification_code уже существует в таблице payments");
    }
    
    // Проверяем, есть ли столбец transaction_id
    const hasTransactionId = rows.some(row => row.name === 'transaction_id');
    
    if (!hasTransactionId) {
      console.log("Добавление столбца transaction_id в таблицу payments...");
      db.run("ALTER TABLE payments ADD COLUMN transaction_id TEXT", (err) => {
        if (err) {
          console.error("Ошибка при добавлении столбца transaction_id:", err);
        } else {
          console.log("Столбец transaction_id успешно добавлен в таблицу payments");
        }
      });
    } else {
      console.log("Столбец transaction_id уже существует в таблице payments");
    }
  });
  
  console.log("Инициализация базы данных завершена");
});

// Настройка Express
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Настройка сессий
app.use(session({
  secret: 'nettyhost-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 } // 1 час
}));

// Middleware для проверки авторизации
const authMiddleware = (req, res, next) => {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login.html');
  }
};

// Статические файлы
app.use(express.static(path.join(__dirname, '.')));

// Роуты для API
app.post('/api/register', (req, res) => {
  const { username, email, password } = req.body;
  
  // Проверка наличия всех полей
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'Все поля обязательны для заполнения' });
  }
  
  // Проверка, не занято ли имя пользователя или email
  db.get('SELECT * FROM users WHERE username = ? OR email = ?', [username, email], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
    
    if (user) {
      return res.status(400).json({ success: false, message: 'Пользователь с таким именем или email уже существует' });
    }
    
    // Хеширование пароля
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Ошибка при хешировании пароля' });
      }
      
      // Сохранение пользователя в базу данных
      db.run('INSERT INTO users (username, email, password) VALUES (?, ?, ?)', [username, email, hash], function(err) {
        if (err) {
          return res.status(500).json({ success: false, message: 'Ошибка при сохранении пользователя' });
        }
        
        // Создание сессии
        req.session.user = { id: this.lastID, username, email };
        
        return res.status(201).json({ success: true, message: 'Регистрация успешна' });
      });
    });
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  // Проверка наличия всех полей
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Имя пользователя и пароль обязательны' });
  }
  
  // Поиск пользователя в базе данных
  db.get('SELECT * FROM users WHERE username = ?', [username], (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
    
    if (!user) {
      return res.status(401).json({ success: false, message: 'Пользователь не найден' });
    }
    
    // Проверка пароля
    bcrypt.compare(password, user.password, (err, match) => {
      if (err) {
        return res.status(500).json({ success: false, message: 'Ошибка при проверке пароля' });
      }
      
      if (!match) {
        return res.status(401).json({ success: false, message: 'Неверный пароль' });
      }
      
      // Создание сессии
      req.session.user = { id: user.id, username: user.username, email: user.email };
      
      return res.status(200).json({ success: true, message: 'Вход выполнен успешно' });
    });
  });
});

app.get('/api/user', authMiddleware, (req, res) => {
  res.json({ user: req.session.user });
});

app.get('/api/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login.html');
});

// Добавим функцию для создания платежа QIWI
async function createQiwiPayment(amount, paymentId, description) {
  try {
    const response = await axios.post('https://api.qiwi.com/partner/bill/v1/bills/' + paymentId, {
      amount: {
        currency: 'RUB',
        value: amount
      },
      comment: description,
      expirationDateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 часа на оплату
      successUrl: `http://localhost:3000/payment/success?bill_id=${paymentId}`
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + QIWI_SECRET_KEY
      }
    });
    
    console.log('QIWI платеж создан:', response.data);
    return response.data;
  } catch (error) {
    console.error('Ошибка при создании QIWI платежа:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Функция для проверки статуса платежа QIWI
async function checkQiwiPaymentStatus(paymentId) {
  try {
    const response = await axios.get('https://api.qiwi.com/partner/bill/v1/bills/' + paymentId, {
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer ' + QIWI_SECRET_KEY
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Ошибка при проверке QIWI платежа:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Добавим функцию для создания платежа Payeer
async function createPayeerPayment(amount, paymentId, description) {
  try {
    // Formulate the data with your Payeer shop ID
    const m_shop = PAYEER_SHOP_ID;
    const m_orderid = paymentId;
    const m_amount = amount.toFixed(2);
    const m_curr = 'RUB';
    const m_desc = Buffer.from(description).toString('base64');
    
    // Create a signature
    const signString = `${m_shop}:${m_amount}:${m_curr}:${m_orderid}:${m_desc}:${PAYEER_SHOP_SECRET}`;
    const sign = crypto.createHash('sha256').update(signString).digest('hex');
    
    // Construct the payment URL
    const paymentUrl = `https://payeer.com/merchant/?m_shop=${m_shop}&m_orderid=${m_orderid}&m_amount=${m_amount}&m_curr=${m_curr}&m_desc=${m_desc}&m_sign=${sign}&lang=ru`;
    
    console.log('Payeer платежная ссылка создана:', paymentUrl);
    
    return {
      payUrl: paymentUrl,
      status: 'success',
      paymentId: paymentId
    };
  } catch (error) {
    console.error('Ошибка при создании Payeer платежа:', error);
    throw error;
  }
}

// Функция для проверки статуса платежа Payeer через API
async function checkPayeerPayment(paymentId) {
  try {
    const authString = Buffer.from(`${PAYEER_API_ID}:${PAYEER_API_KEY}`).toString('base64');
    
    const response = await axios.post('https://payeer.com/api/merchant/getPaymentStatus', {
      merchantId: PAYEER_SHOP_ID,
      orderId: paymentId
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authString}`
      }
    });
    
    console.log('Ответ Payeer:', response.data);
    
    return {
      status: {
        value: response.data.status === 'success' ? 'PAID' : 'WAITING'
      },
      paymentId: paymentId
    };
  } catch (error) {
    console.error('Ошибка при проверке Payeer платежа:', error.response ? error.response.data : error.message);
    return {
      status: {
        value: 'ERROR'
      },
      paymentId: paymentId
    };
  }
}

// Добавим функцию для создания платежа в RoboKassa
async function createRobokassaPayment(amount, paymentId, description) {
  try {
    // Формируем данные для RoboKassa
    const m_login = ROBOKASSA_SHOP_LOGIN;
    const m_orderid = paymentId;
    const m_amount = amount.toFixed(2);
    const m_desc = Buffer.from(description).toString('base64');
    const isTest = ROBOKASSA_TEST_MODE ? '1' : '0';
    
    // Формируем подпись: MerchantLogin:OutSum:InvId:Password
    const signString = `${m_login}:${m_amount}:${m_orderid}:${ROBOKASSA_SHOP_PASSWORD1}`;
    const sign = crypto.createHash('md5').update(signString).digest('hex').toLowerCase();
    
    // Формируем URL для оплаты
    const paymentUrl = `https://auth.robokassa.ru/Merchant/Index.aspx?MerchantLogin=${m_login}&OutSum=${m_amount}&InvId=${m_orderid}&Description=${m_desc}&SignatureValue=${sign}&IsTest=${isTest}`;
    
    console.log('RoboKassa платежная ссылка создана:', paymentUrl);
    
    return {
      payUrl: paymentUrl,
      status: 'success',
      paymentId: paymentId
    };
  } catch (error) {
    console.error('Ошибка при создании RoboKassa платежа:', error);
    throw error;
  }
}

// Функция для проверки статуса платежа в RoboKassa
// RoboKassa не имеет прямого API для проверки статуса, поэтому 
// будем полагаться на уведомления об успешной оплате (ResultURL)
async function checkRobokassaPayment(paymentId) {
  try {
    // Проверяем статус платежа в нашей БД
    return new Promise((resolve, reject) => {
      db.get('SELECT status FROM payments WHERE payment_id = ?', [paymentId], (err, payment) => {
        if (err) {
          console.error('Ошибка при проверке статуса платежа в БД:', err);
          reject(err);
          return;
        }
        
        if (!payment) {
          console.error('Платеж не найден в БД:', paymentId);
          resolve({
            status: {
              value: 'ERROR'
            },
            paymentId: paymentId
          });
          return;
        }
        
        // Преобразуем статус из нашей БД в формат, аналогичный API
        let apiStatus = 'WAITING';
        if (payment.status === 'completed') {
          apiStatus = 'PAID';
        } else if (payment.status === 'failed' || payment.status === 'rejected' || payment.status === 'expired') {
          apiStatus = 'ERROR';
        }
        
        resolve({
          status: {
            value: apiStatus
          },
          paymentId: paymentId
        });
      });
    });
  } catch (error) {
    console.error('Ошибка при проверке RoboKassa платежа:', error);
    return {
      status: {
        value: 'ERROR'
      },
      paymentId: paymentId
    };
  }
}

// Эндпоинт для покупки VDS
app.post('/api/vds/purchase', authMiddleware, async (req, res) => {
  const { plan, paymentMethod } = req.body;
  const userId = req.session.user.id;
  
  console.log(`Создание заказа VDS плана ${plan} для пользователя ${userId}, метод оплаты: ${paymentMethod || 'robokassa'}`);
  
  // Определение цены плана
  let amount = 0;
  switch(plan) {
    case 'basic':
      amount = 300;
      break;
    case 'standard':
      amount = 600;
      break;
    case 'premium':
      amount = 1200;
      break;
    default:
      console.error(`Неверный план: ${plan}`);
      return res.status(400).json({ 
        success: false, 
        message: 'Указан несуществующий план' 
      });
  }
  
  // Генерация уникального ID платежа и кода для проверки
  const paymentId = `payment_vds_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const verificationCode = `VDS${Math.floor(10000 + Math.random() * 90000)}`; // 5-значный код с префиксом VDS
  
  console.log(`Сгенерирован код верификации: ${verificationCode}`);
  
  try {
    // Сохранение информации о платеже в БД
    db.run(
      'INSERT INTO payments (user_id, amount, payment_id, status, verification_code) VALUES (?, ?, ?, ?, ?)',
      [userId, amount, paymentId, 'pending', verificationCode],
      async function(err) {
        if (err) {
          console.error('Ошибка при создании платежа:', err);
          return res.status(500).json({ 
            success: false, 
            message: 'Ошибка при создании платежа' 
          });
        }
        
        const paymentDbId = this.lastID;
        console.log(`Создан платеж с ID ${paymentDbId} в базе данных`);
        
        // Создание записи о VDS сервере
        db.run(
          'INSERT INTO vds_servers (user_id, plan, status, payment_id) VALUES (?, ?, ?, ?)',
          [userId, plan, 'pending', paymentDbId],
          async function(err) {
            if (err) {
              console.error('Ошибка при создании записи о сервере:', err);
              return res.status(500).json({ 
                success: false, 
                message: 'Ошибка при создании записи о сервере' 
              });
            }
            
            const vdsId = this.lastID;
            console.log(`Создан VDS сервер с ID ${vdsId} в базе данных`);
            
            try {
              let paymentUrl = '';
              const paymentMethodToUse = paymentMethod || 'robokassa';
              
              // Выбор платежной системы
              if (paymentMethodToUse === 'webmoney') {
                // Для WebMoney создаем специальную страницу с виджетом
                paymentUrl = `/payment/webmoney/${paymentId}`;
              } else {
                // По умолчанию используем RoboKassa
                const roboPayment = await createRobokassaPayment(
                  amount,
                  paymentId,
                  `Оплата VDS плана ${plan}, код: ${verificationCode}`
                );
                paymentUrl = roboPayment.payUrl;
              }
              
              // Запускаем проверку платежа в фоне
              startPaymentVerification(verificationCode, paymentId, vdsId, plan, userId);
              
              res.status(200).json({
                success: true,
                message: 'Заказ VDS сервера создан',
                payment_id: paymentId,
                verification_code: verificationCode,
                vds_id: vdsId,
                payment_url: paymentUrl,
                payment_method: paymentMethodToUse
              });
            } catch (error) {
              console.error('Ошибка при создании платежа:', error);
              
              // Даже если платеж не создался, отправляем ответ с инфо для ручной проверки
              res.status(200).json({
                success: true,
                message: 'Заказ VDS сервера создан, но возникла проблема с платежной системой',
                payment_id: paymentId,
                verification_code: verificationCode,
                vds_id: vdsId,
                error: 'Не удалось создать автоматический платеж. Пожалуйста, свяжитесь с администратором через Telegram.'
              });
            }
          }
        );
      }
    );
  } catch (error) {
    console.error('Ошибка при создании заказа:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
});

// Webhook для подтверждения платежа от YooMoney
app.post('/api/webhooks/yoomoney', (req, res) => {
  console.log('Получено уведомление от YooMoney:', req.body);
  
  // Проверка обязательных параметров
  const { notification_type, operation_id, amount, currency, datetime, sender, codepro, label, sha1_hash } = req.body;
  
  if (!label) {
    console.error('Ошибка: отсутствует label в запросе от YooMoney');
    return res.status(400).send('Ошибка: отсутствует label в запросе');
  }
  
  // Проверка подписи от YooMoney
  const str = `${notification_type}&${operation_id}&${amount}&${currency}&${datetime}&${sender}&${codepro}&${YOOMONEY_SECRET_KEY}&${label}`;
  const calculatedHash = crypto.createHash('sha1').update(str).digest('hex');
  
  if (calculatedHash !== sha1_hash) {
    console.error('Ошибка: неверная подпись запроса от YooMoney');
    return res.status(400).send('Ошибка: неверная подпись запроса');
  }
  
  // Обновляем статус платежа в базе данных
  const paymentId = label;
  
  db.run('UPDATE payments SET status = ?, transaction_id = ? WHERE payment_id = ?', 
    ['completed', operation_id, paymentId], 
    function(err) {
      if (err) {
        console.error('Ошибка при обновлении статуса платежа:', err);
        return res.status(500).send('Ошибка сервера');
      }
      
      console.log(`Платеж ${paymentId} успешно подтвержден через YooMoney`);
      
      // Проверяем, связан ли этот платеж с заказом VDS сервера
      db.get(
        'SELECT * FROM vds_servers WHERE payment_id = (SELECT id FROM payments WHERE payment_id = ?)',
        [paymentId],
        (err, vds) => {
          if (err) {
            console.error('Ошибка при проверке связанного VDS сервера:', err);
            return res.status(500).send('Ошибка сервера');
          }
          
          if (vds) {
            // Обновляем статус VDS сервера
            db.run('UPDATE vds_servers SET status = ? WHERE id = ?', ['active', vds.id], function(err) {
              if (err) {
                console.error('Ошибка при обновлении статуса VDS сервера:', err);
                return res.status(500).send('Ошибка сервера');
              }
              
              // Отправляем уведомление в Telegram
              const message = `
✅ Платеж подтвержден!

ID заказа: ${vds.id}
План: ${vds.plan}
Статус: Активирован
Способ оплаты: YooMoney
Транзакция: ${operation_id}
              `;
              
              ADMIN_CHAT_IDS.forEach(chatId => {
                bot.sendMessage(chatId, message)
                  .catch(error => console.error(`Ошибка при отправке уведомления админу с ID ${chatId}:`, error));
              });
            });
          }
          
          // Отправляем подтверждение получения уведомления
          return res.status(200).send('OK');
        }
      );
    }
  );
});

// Обработка команды для отправки ссылки пользователю
bot.onText(/\/sendlink (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  
  // Проверяем, является ли отправитель администратором
  if (!ADMIN_CHAT_IDS.includes(chatId.toString())) {
    return bot.sendMessage(chatId, 'У вас нет прав для выполнения этой команды');
  }
  
  const params = match[1].split(' ');
  if (params.length < 2) {
    return bot.sendMessage(chatId, 'Неверный формат команды. Используйте: /sendlink ID_ЗАКАЗА ССЫЛКА');
  }
  
  const vdsId = params[0];
  const accessLink = params.slice(1).join(' ');
  
  // Обновляем запись о VDS с ссылкой доступа
  db.run(
    'UPDATE vds_servers SET access_link = ? WHERE id = ?',
    [accessLink, vdsId],
    function(err) {
      if (err || this.changes === 0) {
        return bot.sendMessage(chatId, `Ошибка при обновлении заказа: ${err ? err.message : 'Заказ не найден'}`);
      }
      
      // Получаем информацию о пользователе
      db.get(
        `SELECT u.username, u.email 
         FROM vds_servers v 
         JOIN users u ON v.user_id = u.id 
         WHERE v.id = ?`,
        [vdsId],
        (err, userInfo) => {
          if (err || !userInfo) {
            return bot.sendMessage(chatId, `Ошибка при получении информации о пользователе: ${err ? err.message : 'Пользователь не найден'}`);
          }
          
          bot.sendMessage(chatId, `✅ Ссылка успешно добавлена к заказу #${vdsId} и доступна пользователю ${userInfo.username}`);
        }
      );
    }
  );
});

// Эндпоинт для пользователя для получения ссылки доступа к VDS
app.get('/api/vds/:id/access', authMiddleware, (req, res) => {
  const vdsId = req.params.id;
  const userId = req.session.user.id;
  
  db.get(
    'SELECT access_link FROM vds_servers WHERE id = ? AND user_id = ?',
    [vdsId, userId],
    (err, vdsInfo) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Ошибка при получении информации о сервере' 
        });
      }
      
      if (!vdsInfo) {
        return res.status(404).json({ 
          success: false, 
          message: 'Сервер не найден или у вас нет к нему доступа' 
        });
      }
      
      res.status(200).json({
        success: true,
        access_link: vdsInfo.access_link || null,
        message: vdsInfo.access_link ? 'Ссылка доступа получена' : 'Ссылка доступа еще не предоставлена'
      });
    }
  );
});

// Новый эндпоинт для создания платежа YooMoney
app.post('/api/payments/create', authMiddleware, async (req, res) => {
  const { amount } = req.body;
  const userId = req.session.user.id;
  
  // Проверка суммы платежа
  if (!amount || amount < 100) {
    return res.status(400).json({ 
      success: false, 
      message: 'Сумма платежа должна быть не менее 100 ₽' 
    });
  }
  
  // Генерация уникального ID платежа
  const paymentId = `payment_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  try {
    // Сохранение информации о платеже в БД
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO payments (user_id, amount, payment_id, status) VALUES (?, ?, ?, ?)',
        [userId, amount, paymentId, 'pending'],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
    
    // Создание платежа YooMoney
    const description = `Пополнение баланса на сумму ${amount} ₽`;
    const paymentResult = await createYooMoneyPayment(amount, paymentId, description);
    
    if (!paymentResult.success) {
      return res.status(500).json({ 
        success: false, 
        message: 'Ошибка при создании платежа' 
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Платеж создан',
      payment_id: paymentId,
      confirmation_url: paymentResult.payment_url
    });
  } catch (error) {
    console.error('Ошибка при создании платежа:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Ошибка при создании платежа' 
    });
  }
});

// Эндпоинт для получения истории платежей пользователя
app.get('/api/payments/history', authMiddleware, (req, res) => {
  const userId = req.session.user.id;
  
  db.all(
    'SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
    (err, payments) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Ошибка при получении истории платежей' 
        });
      }
      
      res.status(200).json({
        success: true,
        payments: payments
      });
    }
  );
});

// Эндпоинт для получения списка VDS серверов пользователя
app.get('/api/vds/list', authMiddleware, (req, res) => {
  const userId = req.session.user.id;
  
  db.all(
    `SELECT v.id, v.plan, v.status, v.access_link, v.created_at 
     FROM vds_servers v 
     WHERE v.user_id = ? 
     ORDER BY v.created_at DESC`,
    [userId],
    (err, servers) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Ошибка при получении списка серверов' 
        });
      }
      
      res.status(200).json({
        success: true,
        servers: servers
      });
    }
  );
});

// Защищенные маршруты
app.get('/dashboard.html', authMiddleware, (req, res) => {
  res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// Обработка корневого маршрута
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/dashboard.html');
  } else {
    res.redirect('/login.html');
  }
});

// Запуск сервера
app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}`);
});

// Таблица активных проверок платежей
const activePaymentChecks = {};

// Функция запуска проверки платежа
function startPaymentVerification(verificationCode, paymentId, vdsId, plan, userId) {
  if (activePaymentChecks[verificationCode]) {
    clearTimeout(activePaymentChecks[verificationCode]);
    delete activePaymentChecks[verificationCode];
  }
  
  // Получаем цену плана
  let amount = 0;
  switch(plan) {
    case 'basic':
      amount = 300;
      break;
    case 'standard':
      amount = 600;
      break;
    case 'premium':
      amount = 1200;
      break;
    default:
      amount = 300;
  }
  
  // Отправляем уведомление в Telegram о новом платеже
  const message = `
🆕 Новый заказ VDS!

ID заказа: ${vdsId}
План: ${plan}
Сумма: ${amount} ₽
Код верификации: ${verificationCode}
Способ оплаты: YooMoney (${YOOMONEY_WALLET})

Платеж будет проверен автоматически после оплаты через YooMoney.
Или можете подтвердить вручную командой:
/confirm ${verificationCode}
`;

  // Отправка уведомления администраторам
  ADMIN_CHAT_IDS.forEach(chatId => {
    bot.sendMessage(chatId, message)
      .then(msg => {
        console.log(`Уведомление о новом заказе отправлено админу с ID ${chatId}`);
      })
      .catch(error => {
        console.error(`Ошибка при отправке уведомления админу с ID ${chatId}:`, error);
      });
  });
  
  // Функция для проверки статуса платежа
  const checkPayment = async () => {
    try {
      // Получаем статус платежа из YooMoney (проверка через нашу БД)
      const paymentInfo = await checkYooMoneyPayment(paymentId);
      const status = paymentInfo.status.value;
      
      console.log(`Проверка платежа ${paymentId}, статус: ${status}`);
      
      if (status === 'PAID') {
        // Платеж успешный
        db.run('UPDATE payments SET status = ? WHERE payment_id = ?', ['completed', paymentId], function(err) {
          if (err) {
            console.error('Ошибка при обновлении статуса платежа:', err);
            return;
          }
          
          // Обновляем статус VDS сервера
          db.get('SELECT id FROM payments WHERE payment_id = ?', [paymentId], (err, payment) => {
            if (err || !payment) {
              console.error('Ошибка при получении ID платежа:', err);
              return;
            }
            
            db.run('UPDATE vds_servers SET status = ? WHERE payment_id = ?', ['active', payment.id], function(err) {
              if (err) {
                console.error('Ошибка при обновлении статуса VDS сервера:', err);
                return;
              }
              
              // Получаем информацию о заказе для отправки уведомления
              db.get(
                'SELECT v.id, v.plan, u.username, u.email FROM vds_servers v JOIN users u ON v.user_id = u.id WHERE v.id = ?',
                [vdsId],
                (err, orderInfo) => {
                  if (err || !orderInfo) {
                    console.error('Ошибка при получении информации о заказе:', err);
                    return;
                  }
                  
                  // Отправляем уведомление о завершении платежа
                  ADMIN_CHAT_IDS.forEach(chatId => {
                    bot.sendMessage(chatId, `
✅ Платеж подтвержден!

ID заказа: ${vdsId}
План: ${plan}
Статус: Активирован
Способ оплаты: YooMoney
Пользователь: ${orderInfo.username}
Email: ${orderInfo.email}

Для предоставления доступа, ответьте с ссылкой, используя команду:
/sendlink ${vdsId} ВАША_ССЫЛКА
                    `)
                    .catch(error => {
                      console.error(`Ошибка при отправке уведомления админу с ID ${chatId}:`, error);
                    });
                  });
                }
              );
              
              // Удаляем проверку из активных
              clearTimeout(activePaymentChecks[verificationCode]);
              delete activePaymentChecks[verificationCode];
            });
          });
        });
      } else if (status === 'FAILED') {
        // Платеж неуспешный
        db.run('UPDATE payments SET status = ? WHERE payment_id = ?', ['failed', paymentId], function(err) {
          if (err) {
            console.error('Ошибка при обновлении статуса платежа:', err);
            return;
          }
          
          // Удаляем проверку из активных
          clearTimeout(activePaymentChecks[verificationCode]);
          delete activePaymentChecks[verificationCode];
        });
      } else {
        // Платеж в процессе, продолжаем проверку
        activePaymentChecks[verificationCode] = setTimeout(checkPayment, 60000); // Повторная проверка через 1 минуту
      }
    } catch (error) {
      console.error('Ошибка при проверке статуса платежа:', error);
      // Повторяем проверку через 1 минуту
      activePaymentChecks[verificationCode] = setTimeout(checkPayment, 60000);
    }
  };
  
  // Запускаем первую проверку через 1 минуту
  activePaymentChecks[verificationCode] = setTimeout(checkPayment, 60000);
  
  console.log(`Запущена проверка платежа ${paymentId} с кодом ${verificationCode}`);
}

// Обработка команды подтверждения платежа
bot.onText(/\/confirm (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  
  // Проверяем, является ли отправитель администратором
  if (!ADMIN_CHAT_IDS.includes(chatId.toString())) {
    return bot.sendMessage(chatId, 'У вас нет прав для выполнения этой команды');
  }
  
  const verificationCode = match[1].trim();
  
  // Получаем информацию о платеже
  db.get('SELECT payment_id, status FROM payments WHERE verification_code = ?', [verificationCode], (err, payment) => {
    if (err) {
      console.error('Ошибка при получении информации о платеже:', err);
      return bot.sendMessage(chatId, `Ошибка при проверке платежа: ${err.message}`);
    }
    
    if (!payment) {
      return bot.sendMessage(chatId, `Платеж с кодом ${verificationCode} не найден`);
    }
    
    if (payment.status !== 'pending') {
      return bot.sendMessage(chatId, `Платеж с кодом ${verificationCode} уже имеет статус ${payment.status}`);
    }
    
    // Обновляем статус платежа
    db.run('UPDATE payments SET status = ? WHERE verification_code = ?', ['completed', verificationCode], function(err) {
      if (err) {
        console.error('Ошибка при обновлении статуса платежа:', err);
        return bot.sendMessage(chatId, `Ошибка при обновлении статуса платежа: ${err.message}`);
      }
      
      // Найти ID платежа в базе
      db.get('SELECT id FROM payments WHERE verification_code = ?', [verificationCode], (err, paymentInfo) => {
        if (err || !paymentInfo) {
          console.error('Ошибка при получении ID платежа:', err);
          return bot.sendMessage(chatId, 'Ошибка при получении ID платежа');
        }
        
        // Обновляем статус VDS сервера
        db.run('UPDATE vds_servers SET status = ? WHERE payment_id = ?', ['active', paymentInfo.id], function(err) {
          if (err) {
            console.error('Ошибка при обновлении статуса сервера:', err);
            return bot.sendMessage(chatId, `Ошибка при обновлении статуса сервера: ${err.message}`);
          }
          
          // Получаем информацию о заказе и пользователе для отправки уведомления
          db.get(
            `SELECT v.id as vds_id, v.plan, u.username, u.email 
             FROM vds_servers v 
             JOIN users u ON v.user_id = u.id 
             WHERE v.payment_id = ?`,
            [paymentInfo.id],
            (err, orderInfo) => {
              if (err || !orderInfo) {
                console.error('Ошибка при получении информации о заказе:', err);
                return bot.sendMessage(chatId, 'Ошибка при получении информации о заказе');
              }
              
              // Отправка уведомления пользователю (через админский бот)
              bot.sendMessage(chatId, `✅ Платеж RoboKassa подтвержден и сервер #${orderInfo.vds_id} активирован для пользователя ${orderInfo.username}!
              
Теперь вы можете отправить ссылку доступа с помощью команды:
/sendlink ${orderInfo.vds_id} ВАША_ССЫЛКА`);
              
              // Очищаем таймер проверки, если он был установлен
              if (activePaymentChecks[verificationCode]) {
                clearTimeout(activePaymentChecks[verificationCode]);
                delete activePaymentChecks[verificationCode];
              }
            }
          );
        });
      });
    });
  });
});

// Обработка команды для создания инвойса на оплату
bot.onText(/\/invoice (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  
  // Проверяем, является ли отправитель администратором
  if (!ADMIN_CHAT_IDS.includes(chatId.toString())) {
    return bot.sendMessage(chatId, 'У вас нет прав для выполнения этой команды');
  }
  
  const params = match[1].split(' ');
  if (params.length < 2) {
    return bot.sendMessage(chatId, 'Неверный формат команды. Используйте: /invoice КОД_ВЕРИФИКАЦИИ ПЛАН');
  }
  
  const verificationCode = params[0];
  const plan = params[1];
  
  // Получаем информацию о заказе
  db.get(
    `SELECT v.id as vds_id, v.user_id, v.status, p.id as payment_id
     FROM vds_servers v 
     JOIN payments p ON v.payment_id = p.id
     WHERE p.verification_code = ?`,
    [verificationCode],
    (err, orderInfo) => {
      if (err || !orderInfo) {
        return bot.sendMessage(chatId, `Ошибка при получении информации о заказе: ${err ? err.message : 'Заказ не найден'}`);
      }
      
      if (orderInfo.status !== 'pending') {
        return bot.sendMessage(chatId, `Заказ #${orderInfo.vds_id} имеет статус ${orderInfo.status} и не может быть оплачен`);
      }
      
      // Получаем цену плана
      let amount = 0;
      switch(plan) {
        case 'basic':
          amount = 300;
          break;
        case 'standard':
          amount = 600;
          break;
        case 'premium':
          amount = 1200;
          break;
        default:
          return bot.sendMessage(chatId, `Неверный план: ${plan}. Доступные планы: basic, standard, premium`);
      }
      
      // Создаем инвойс
      const invoiceOptions = {
        chat_id: chatId,
        title: `Оплата VDS сервера (${plan})`,
        description: `Заказ #${orderInfo.vds_id}, верификационный код: ${verificationCode}`,
        payload: verificationCode,
        provider_token: TELEGRAM_PAYMENT_TOKEN,
        currency: 'RUB',
        prices: [{ label: `VDS План ${plan}`, amount: amount * 100 }], // В копейках
        start_parameter: `vds_${orderInfo.vds_id}`,
        photo_url: 'https://example.com/vds-image.jpg', // Опционально
        need_name: false,
        need_phone_number: false,
        need_email: false,
        need_shipping_address: false,
        is_flexible: false
      };
      
      bot.sendInvoice(chatId, invoiceOptions)
        .then(msg => {
          bot.sendMessage(chatId, 'Инвойс создан. Вы можете переслать его клиенту для оплаты.');
        })
        .catch(error => {
          console.error('Ошибка при создании инвойса:', error);
          bot.sendMessage(chatId, `Ошибка при создании инвойса: ${error.message}`);
        });
    }
  );
});

// Обработка успешных платежей
bot.on('pre_checkout_query', (query) => {
  // Всегда подтверждаем запрос на предварительную проверку
  bot.answerPreCheckoutQuery(query.id, true);
});

// Обработка успешных платежей
bot.on('successful_payment', (msg) => {
  const verificationCode = msg.successful_payment.invoice_payload;
  const chatId = msg.chat.id;
  
  console.log(`Получен успешный платеж: ${verificationCode}`);
  
  // Обновляем статус платежа в БД
  db.run('UPDATE payments SET status = ? WHERE verification_code = ?', ['completed', verificationCode], function(err) {
    if (err) {
      console.error('Ошибка при обновлении статуса платежа:', err);
      return bot.sendMessage(chatId, `Ошибка при обновлении статуса платежа: ${err.message}`);
    }
    
    // Найти ID платежа в базе
    db.get('SELECT id FROM payments WHERE verification_code = ?', [verificationCode], (err, paymentInfo) => {
      if (err || !paymentInfo) {
        console.error('Ошибка при получении ID платежа:', err);
        return bot.sendMessage(chatId, 'Ошибка при получении ID платежа');
      }
      
      // Обновляем статус VDS сервера
      db.run('UPDATE vds_servers SET status = ? WHERE payment_id = ?', ['active', paymentInfo.id], function(err) {
        if (err) {
          console.error('Ошибка при обновлении статуса сервера:', err);
          return bot.sendMessage(chatId, `Ошибка при обновлении статуса сервера: ${err.message}`);
        }
        
        // Получаем информацию о заказе и пользователе для отправки уведомления
        db.get(
          `SELECT v.id as vds_id, v.plan, u.username, u.email 
           FROM vds_servers v 
           JOIN users u ON v.user_id = u.id 
           WHERE v.payment_id = ?`,
          [paymentInfo.id],
          (err, orderInfo) => {
            if (err || !orderInfo) {
              console.error('Ошибка при получении информации о заказе:', err);
              return bot.sendMessage(chatId, 'Ошибка при получении информации о заказе');
            }
            
            // Отправка уведомления пользователю (через админский бот)
            ADMIN_CHAT_IDS.forEach(adminChatId => {
              bot.sendMessage(adminChatId, `✅ Платеж подтвержден и сервер #${orderInfo.vds_id} активирован для пользователя ${orderInfo.username}!
              
Теперь вы можете отправить ссылку доступа с помощью команды:
/sendlink ${orderInfo.vds_id} ВАША_ССЫЛКА`);
            });
            
            // Очищаем таймер проверки, если он был установлен
            if (activePaymentChecks[verificationCode]) {
              clearTimeout(activePaymentChecks[verificationCode]);
              delete activePaymentChecks[verificationCode];
            }
          }
        );
      });
    });
  });
});

// Страница успешной оплаты (SuccessURL)
app.get('/payment/success', (req, res) => {
  const invId = req.query.InvId || req.query.m_orderid || req.query.bill_id;
  
  if (!invId) {
    return res.redirect('/dashboard.html?payment=error');
  }
  
  // Проверим статус платежа
  db.get('SELECT status FROM payments WHERE payment_id = ?', [invId], (err, payment) => {
    if (err || !payment) {
      console.error('Ошибка при получении информации о платеже:', err);
      return res.redirect('/dashboard.html?payment=error');
    }
    
    // Редирект на dashboard с параметром статуса
    if (payment.status === 'completed') {
      return res.redirect('/dashboard.html?payment=success');
    } else {
      // Проверим платеж в нашей системе
      checkRobokassaPayment(invId)
        .then(paymentInfo => {
          if (paymentInfo.status.value === 'PAID') {
            // Платеж успешный, но статус еще не обновился в БД
            // Обновим его
            db.run('UPDATE payments SET status = ? WHERE payment_id = ?', ['completed', invId], function(err) {
              if (err) {
                console.error('Ошибка при обновлении статуса платежа:', err);
                return res.redirect('/dashboard.html?payment=pending');
              }
              
              return res.redirect('/dashboard.html?payment=success');
            });
          } else {
            // Платеж не оплачен
            return res.redirect('/dashboard.html?payment=pending');
          }
        })
        .catch(error => {
          console.error('Ошибка при проверке статуса платежа:', error);
          return res.redirect('/dashboard.html?payment=pending');
        });
    }
  });
});

// Страница ошибки оплаты (FailURL)
app.get('/payment/fail', (req, res) => {
  const invId = req.query.InvId || req.query.m_orderid || req.query.bill_id;
  
  if (invId) {
    // Обновляем статус платежа на rejected если он был pending
    db.run(
      'UPDATE payments SET status = ? WHERE payment_id = ? AND status = ?',
      ['rejected', invId, 'pending'],
      function(err) {
        if (err) {
          console.error('Ошибка при обновлении статуса платежа:', err);
        }
      }
    );
  }
  
  res.redirect('/dashboard.html?payment=failed');
});

// WebMoney уведомление о платеже (Result URL)
app.post('/api/payment/webmoney-result', (req, res) => {
  // Проверка подписи и обработка уведомления от WebMoney
  const { 
    LMI_PAYMENT_NO, 
    LMI_SYS_PAYMENT_ID, 
    LMI_PAYMENT_AMOUNT,
    LMI_HASH
  } = req.body;
  
  // Проверка подписи с использованием нашего сгенерированного ключа
  const string = `${LMI_PAYMENT_NO}${LMI_SYS_PAYMENT_ID}${LMI_PAYMENT_AMOUNT}${QIWI_SECRET_KEY}`;
  const calculatedHash = crypto.createHash('md5').update(string).digest('hex').toUpperCase();
  
  console.log('Расчетный хеш:', calculatedHash);
  console.log('Полученный хеш:', LMI_HASH);
  
  // Проверяем подпись (можно отключить для тестирования)
  if (LMI_HASH && calculatedHash !== LMI_HASH) {
    console.error('Неверная подпись WebMoney');
    return res.status(200).send('ERROR: Неверная подпись');
  }
  
  console.log('Получено уведомление о платеже WebMoney:', {
    payment_id: LMI_PAYMENT_NO,
    system_id: LMI_SYS_PAYMENT_ID,
    amount: LMI_PAYMENT_AMOUNT
  });
  
  // Обновляем статус платежа в БД
  db.run(
    'UPDATE payments SET status = ? WHERE payment_id = ?',
    ['completed', LMI_PAYMENT_NO],
    function(err) {
      if (err || this.changes === 0) {
        console.error('Ошибка при обновлении статуса платежа:', err);
        return res.status(200).send('ERROR');
      }
      
      // Найти ID платежа в базе
      db.get('SELECT id FROM payments WHERE payment_id = ?', [LMI_PAYMENT_NO], (err, payment) => {
        if (err || !payment) {
          console.error('Платеж не найден:', err);
          return res.status(200).send('ERROR');
        }
        
        // Обновляем статус VDS сервера
        db.run(
          'UPDATE vds_servers SET status = ? WHERE payment_id = ?',
          ['active', payment.id],
          function(err) {
            if (err || this.changes === 0) {
              console.error('Ошибка при обновлении статуса сервера:', err);
              return res.status(200).send('ERROR');
            }
            
            // Получаем информацию о заказе и пользователе для отправки уведомления
            db.get(
              `SELECT v.id as vds_id, v.plan, u.username, u.email 
               FROM vds_servers v 
               JOIN users u ON v.user_id = u.id 
               WHERE v.payment_id = ?`,
              [payment.id],
              (err, orderInfo) => {
                if (err || !orderInfo) {
                  console.error('Ошибка при получении информации о заказе:', err);
                  return res.status(200).send('ERROR');
                }
                
                // Отправка уведомления администраторам в Telegram
                notifyAdminsAboutVDSPurchase(orderInfo);
                
                res.status(200).send('YES');
              }
            );
          }
        );
      });
    }
  );
});

// Добавляем роут для получения информации о способе оплаты
app.get('/api/vds/payment-info/:vdsId', authMiddleware, (req, res) => {
  const vdsId = req.params.vdsId;
  const userId = req.session.user.id;
  
  // Получаем информацию о VDS и платеже
  db.get(
    `SELECT v.id, v.plan, v.status, p.verification_code, p.amount, p.payment_id
     FROM vds_servers v 
     JOIN payments p ON v.payment_id = p.id
     WHERE v.id = ? AND v.user_id = ?`,
    [vdsId, userId],
    (err, vdsInfo) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Ошибка при получении информации о сервере' 
        });
      }
      
      if (!vdsInfo) {
        return res.status(404).json({ 
          success: false, 
          message: 'Сервер не найден или у вас нет к нему доступа' 
        });
      }
      
      // Формируем базовый URL сайта
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      
      // Формируем информацию для оплаты WebMoney
      const paymentInfo = {
        webmoney_purse: QIWI_WALLET,
        amount: vdsInfo.amount,
        plan: vdsInfo.plan,
        verification_code: vdsInfo.verification_code,
        payment_id: vdsInfo.payment_id,
        payment_link: `https://merchant.webmoney.ru/lmi/payment.asp?at=authtype_1&ShopId=${QIWI_WALLET}&ShopOrderId=${vdsInfo.payment_id}&Amount=${vdsInfo.amount}&Description=${encodeURIComponent(`Оплата VDS плана ${vdsInfo.plan}, код: ${vdsInfo.verification_code}`)}&SuccessURL=${encodeURIComponent(`${baseUrl}/payment/success?LMI_PAYMENT_NO=${vdsInfo.payment_id}`)}&FailURL=${encodeURIComponent(`${baseUrl}/payment/fail?LMI_PAYMENT_NO=${vdsInfo.payment_id}`)}`
      };
      
      res.status(200).json({
        success: true,
        payment_info: paymentInfo
      });
    }
  );
});

// Обработчик webhook от QIWI
app.post('/api/payment/qiwi-hook', async (req, res) => {
  try {
    // Проверяем подпись запроса (в реальном приложении)
    const hmacHeader = req.headers['x-api-signature-sha256'];
    
    // В реальном приложении здесь должна быть проверка подписи
    // const signature = crypto.createHmac('sha256', QIWI_SECRET_KEY)
    //   .update(JSON.stringify(req.body))
    //   .digest('hex');
    // 
    // if (hmacHeader !== signature) {
    //   console.error('Неверная подпись QIWI webhook');
    //   return res.status(403).send('Forbidden');
    // }
    
    const notification = req.body;
    const paymentId = notification.bill.billId;
    const status = notification.bill.status.value;
    
    console.log(`Получено уведомление от QIWI: платеж ${paymentId}, статус ${status}`);
    
    if (status === 'PAID') {
      // Обновляем статус платежа в БД
      db.run(
        'UPDATE payments SET status = ? WHERE payment_id = ?',
        ['completed', paymentId],
        function(err) {
          if (err || this.changes === 0) {
            console.error('Ошибка при обновлении статуса платежа:', err);
            return res.status(200).send('OK'); // Отвечаем OK чтобы QIWI не повторял запрос
          }
          
          // Найти ID платежа в базе
          db.get('SELECT id FROM payments WHERE payment_id = ?', [paymentId], (err, payment) => {
            if (err || !payment) {
              console.error('Платеж не найден:', err);
              return res.status(200).send('OK');
            }
            
            // Обновляем статус VDS сервера
            db.run(
              'UPDATE vds_servers SET status = ? WHERE payment_id = ?',
              ['active', payment.id],
              function(err) {
                if (err || this.changes === 0) {
                  console.error('Ошибка при обновлении статуса сервера:', err);
                  return res.status(200).send('OK');
                }
                
                // Получаем информацию о заказе и пользователе для отправки уведомления
                db.get(
                  `SELECT v.id as vds_id, v.plan, u.username, u.email 
                   FROM vds_servers v 
                   JOIN users u ON v.user_id = u.id 
                   WHERE v.payment_id = ?`,
                  [payment.id],
                  (err, orderInfo) => {
                    if (err || !orderInfo) {
                      console.error('Ошибка при получении информации о заказе:', err);
                      return res.status(200).send('OK');
                    }
                    
                    // Отправка уведомления администраторам в Telegram
                    notifyAdminsAboutVDSPurchase(orderInfo);
                    
                    res.status(200).send('OK');
                  }
                );
              }
            );
          });
        }
      );
    } else if (status === 'REJECTED' || status === 'EXPIRED') {
      // Если платеж отклонен или просрочен
      db.run(
        'UPDATE payments SET status = ? WHERE payment_id = ?',
        [status === 'REJECTED' ? 'rejected' : 'expired', paymentId],
        function(err) {
          if (err) {
            console.error('Ошибка при обновлении статуса платежа:', err);
          }
          
          // Найти ID платежа в базе
          db.get('SELECT id FROM payments WHERE payment_id = ?', [paymentId], (err, payment) => {
            if (err || !payment) {
              console.error('Платеж не найден:', err);
              return res.status(200).send('OK');
            }
            
            // Обновляем статус VDS сервера
            db.run(
              'UPDATE vds_servers SET status = ? WHERE payment_id = ?',
              ['cancelled', payment.id],
              function(err) {
                if (err) {
                  console.error('Ошибка при обновлении статуса сервера:', err);
                }
                
                res.status(200).send('OK');
              }
            );
          });
        }
      );
    } else {
      // Другие статусы (WAITING, CREATED и т.д.)
      console.log(`Платеж ${paymentId} имеет статус ${status}, никаких действий не требуется`);
      res.status(200).send('OK');
    }
  } catch (error) {
    console.error('Ошибка при обработке webhook от QIWI:', error);
    res.status(500).send('Internal Server Error');
  }
});

// Обработчик webhook от Payeer
app.post('/api/payment/payeer-hook', async (req, res) => {
  try {
    console.log('Получен webhook от Payeer:', req.body);
    
    // Получаем данные платежа
    const {
      m_operation_id,
      m_operation_ps,
      m_operation_date,
      m_operation_pay_date,
      m_shop,
      m_orderid,
      m_amount,
      m_curr,
      m_desc,
      m_status,
      m_sign
    } = req.body;
    
    // Проверяем подпись
    const signString = `${m_operation_id}:${m_operation_ps}:${m_operation_date}:${m_operation_pay_date}:${m_shop}:${m_orderid}:${m_amount}:${m_curr}:${m_desc}:${m_status}:${PAYEER_SHOP_SECRET}`;
    const calculatedSign = crypto.createHash('sha256').update(signString).digest('hex').toUpperCase();
    
    if (m_sign !== calculatedSign) {
      console.error('Неверная подпись webhook Payeer');
      return res.status(400).send('Invalid signature');
    }
    
    // Проверяем ID магазина
    if (m_shop !== PAYEER_SHOP_ID) {
      console.error('Неверный ID магазина');
      return res.status(400).send('Invalid shop ID');
    }
    
    // Проверяем статус платежа
    if (m_status !== 'success') {
      console.log(`Платеж ${m_orderid} имеет статус ${m_status}, пропускаем обработку`);
      return res.status(200).send('OK');
    }
    
    // Обновляем статус платежа в БД
    const paymentId = m_orderid;
    db.run(
      'UPDATE payments SET status = ? WHERE payment_id = ?',
      ['completed', paymentId],
      function(err) {
        if (err || this.changes === 0) {
          console.error('Ошибка при обновлении статуса платежа:', err);
          return res.status(200).send('OK'); // Всегда отвечаем OK для Payeer
        }
        
        // Найти ID платежа в базе
        db.get('SELECT id FROM payments WHERE payment_id = ?', [paymentId], (err, payment) => {
          if (err || !payment) {
            console.error('Платеж не найден:', err);
            return res.status(200).send('OK');
          }
          
          // Обновляем статус VDS сервера
          db.run(
            'UPDATE vds_servers SET status = ? WHERE payment_id = ?',
            ['active', payment.id],
            function(err) {
              if (err || this.changes === 0) {
                console.error('Ошибка при обновлении статуса сервера:', err);
                return res.status(200).send('OK');
              }
              
              // Получаем информацию о заказе и пользователе для отправки уведомления
              db.get(
                `SELECT v.id as vds_id, v.plan, u.username, u.email 
                 FROM vds_servers v 
                 JOIN users u ON v.user_id = u.id 
                 WHERE v.payment_id = ?`,
                [payment.id],
                (err, orderInfo) => {
                  if (err || !orderInfo) {
                    console.error('Ошибка при получении информации о заказе:', err);
                    return res.status(200).send('OK');
                  }
                  
                  // Отправка уведомления администраторам в Telegram
                  notifyAdminsAboutVDSPurchase(orderInfo);
                  
                  res.status(200).send('OK');
                }
              );
            }
          );
        });
      }
    );
  } catch (error) {
    console.error('Ошибка при обработке webhook от Payeer:', error);
    res.status(200).send('OK'); // Всегда отвечаем OK для Payeer
  }
});

// Обработчик webhook от RoboKassa (Result URL)
app.post('/api/payment/robokassa-result', async (req, res) => {
  try {
    console.log('Получен Result URL от RoboKassa:', req.body);
    
    // Получаем данные платежа
    const {
      OutSum, // Сумма платежа
      InvId, // Номер заказа
      SignatureValue // Подпись
    } = req.body;
    
    // Проверяем подпись
    const expectedSignature = crypto.createHash('md5')
      .update(`${OutSum}:${InvId}:${ROBOKASSA_SHOP_PASSWORD2}`)
      .digest('hex')
      .toLowerCase();
    
    if (SignatureValue.toLowerCase() !== expectedSignature) {
      console.error('Неверная подпись webhook RoboKassa');
      return res.status(400).send('Invalid signature');
    }
    
    const paymentId = InvId;
    
    // Обновляем статус платежа в БД
    db.run(
      'UPDATE payments SET status = ? WHERE payment_id = ?',
      ['completed', paymentId],
      function(err) {
        if (err || this.changes === 0) {
          console.error('Ошибка при обновлении статуса платежа:', err);
          return res.status(200).send('ERROR');
        }
        
        // Найти ID платежа в базе
        db.get('SELECT id FROM payments WHERE payment_id = ?', [paymentId], (err, payment) => {
          if (err || !payment) {
            console.error('Платеж не найден:', err);
            return res.status(200).send('ERROR');
          }
          
          // Обновляем статус VDS сервера
          db.run(
            'UPDATE vds_servers SET status = ? WHERE payment_id = ?',
            ['active', payment.id],
            function(err) {
              if (err || this.changes === 0) {
                console.error('Ошибка при обновлении статуса сервера:', err);
                return res.status(200).send('ERROR');
              }
              
              // Получаем информацию о заказе и пользователе для отправки уведомления
              db.get(
                `SELECT v.id as vds_id, v.plan, u.username, u.email 
                 FROM vds_servers v 
                 JOIN users u ON v.user_id = u.id 
                 WHERE v.payment_id = ?`,
                [payment.id],
                (err, orderInfo) => {
                  if (err || !orderInfo) {
                    console.error('Ошибка при получении информации о заказе:', err);
                    return res.status(200).send('ERROR');
                  }
                  
                  // Отправка уведомления администраторам в Telegram
                  notifyAdminsAboutVDSPurchase(orderInfo);
                  
                  // Возвращаем "OK" для RoboKassa
                  res.status(200).send('OK');
                }
              );
            }
          );
        });
      }
    );
  } catch (error) {
    console.error('Ошибка при обработке webhook от RoboKassa:', error);
    res.status(200).send('ERROR');
  }
}); 

// WebMoney настройки
const WEBMONEY_PURSE = 'Z549692842691'; // WebMoney Z-кошелек
const WEBMONEY_SECRET_KEY = crypto.createHash('md5').update(WEBMONEY_PURSE + 'nettyhost_salt').digest('hex'); // Генерируем ключ на основе кошелька

// Обработчик обновлений от WebMoney виджета
app.post('/api/payment/webmoney-update', async (req, res) => {
  try {
    console.log('Получено обновление от WebMoney виджета:', req.body);
    
    const { paymentId, transactionId } = req.body;
    
    // Проверяем наличие необходимых параметров
    if (!paymentId || !transactionId) {
      console.error('Отсутствуют необходимые параметры платежа');
      return res.status(400).json({ success: false, message: 'Недостаточно данных для обработки платежа' });
    }
    
    // Обновляем статус платежа в БД
    db.run(
      'UPDATE payments SET status = ?, transaction_id = ? WHERE payment_id = ? AND status = ?',
      ['completed', transactionId, paymentId, 'pending'],
      function(err) {
        if (err) {
          console.error('Ошибка при обновлении статуса платежа:', err);
          return res.status(500).json({ success: false, message: 'Ошибка при обновлении статуса платежа' });
        }
        
        if (this.changes === 0) {
          console.log(`Платеж ${paymentId} не найден или уже обработан`);
          return res.status(200).json({ success: true, message: 'Платеж уже обработан или не найден' });
        }
        
        // Найти ID платежа в базе
        db.get('SELECT id FROM payments WHERE payment_id = ?', [paymentId], (err, payment) => {
          if (err || !payment) {
            console.error('Платеж не найден:', err);
            return res.status(500).json({ success: false, message: 'Ошибка при получении информации о платеже' });
          }
          
          // Обновляем статус VDS сервера
          db.run(
            'UPDATE vds_servers SET status = ? WHERE payment_id = ?',
            ['active', payment.id],
            function(err) {
              if (err) {
                console.error('Ошибка при обновлении статуса сервера:', err);
                return res.status(500).json({ success: false, message: 'Ошибка при обновлении статуса сервера' });
              }
              
              // Получаем информацию о заказе и пользователе для отправки уведомления
              db.get(
                `SELECT v.id as vds_id, v.plan, u.username, u.email, u.id as user_id 
                 FROM vds_servers v 
                 JOIN users u ON v.user_id = u.id 
                 WHERE v.payment_id = ?`,
                [payment.id],
                (err, orderInfo) => {
                  if (err || !orderInfo) {
                    console.error('Ошибка при получении информации о заказе:', err);
                    return res.status(500).json({ success: false, message: 'Ошибка при получении информации о заказе' });
                  }
                  
                  // Отправка уведомления администраторам в Telegram
                  notifyAdminsAboutVDSPurchase(orderInfo);
                  
                  // Возвращаем успешный ответ
                  res.status(200).json({ 
                    success: true, 
                    message: 'Платеж успешно обработан',
                    vds_id: orderInfo.vds_id
                  });
                }
              );
            }
          );
        });
      }
    );
  } catch (error) {
    console.error('Ошибка при обработке обновления от WebMoney:', error);
    res.status(500).json({ success: false, message: 'Внутренняя ошибка сервера' });
  }
});

// Функция для генерации HTML страницы с WebMoney виджетом
function generateWebMoneyWidgetHtml(amount, paymentId, plan, description) {
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Оплата заказа | NettyHost</title>
  <link rel="stylesheet" href="/styles.css">
  <style>
    .payment-container {
      max-width: 600px;
      margin: 50px auto;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.1);
      text-align: center;
    }
    .payment-details {
      margin: 20px 0;
      padding: 15px;
      background: #f5f5f5;
      border-radius: 5px;
      text-align: left;
    }
    .payment-details p {
      margin: 10px 0;
    }
    .widget-container {
      margin: 30px auto;
      max-width: 300px;
    }
    .back-button {
      margin-top: 20px;
      display: inline-block;
      padding: 10px 20px;
      background: #f0f0f0;
      border-radius: 5px;
      text-decoration: none;
      color: #333;
    }
  </style>
</head>
<body>
  <div class="payment-container">
    <h1>Оплата VDS сервера</h1>
    
    <div class="payment-details">
      <p><strong>План:</strong> ${plan}</p>
      <p><strong>Сумма к оплате:</strong> ${amount} ₽</p>
      <p><strong>Описание:</strong> ${description}</p>
      <p><strong>ID платежа:</strong> ${paymentId}</p>
    </div>
    
    <div class="widget-container">
      <div id='wm-widget'></div>
    </div>
    
    <a href="/dashboard.html" class="back-button">Вернуться в личный кабинет</a>
  </div>
  
  <script type='text/javascript' src='https://merchant.webmoney.ru/conf/lib/widgets/wmApp.js?v=1.6'></script>
  <script type='text/javascript'>
    const paymentId = "${paymentId}";
    window.webmoney.widgets().button.create({
      "data": {
        "amount": "${amount}",
        "purse": "${WEBMONEY_PURSE}",
        "desc": "${description}",
        "paymentType": "card",
        "forcePay": true
      },
      "style": {
        "theme": "wm",
        "showAmount": true,
        "titleNum": 1,
        "title": "Оплатить картой",
        "design": "skeuomorph"
      },
      "lang": "ru"
    }).on('paymentComplete', function(data) {
      // Отправка на сервер для обновления статуса платежа
      fetch('/api/payment/webmoney-update', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          paymentId: paymentId,
          transactionId: data.transactionId || 'wm_' + Date.now()
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          alert('Платеж успешно обработан! Перенаправление в личный кабинет...');
          window.location.href = '/dashboard.html?payment=success';
        } else {
          alert('Произошла ошибка при обработке платежа. Пожалуйста, свяжитесь с администратором.');
        }
      })
      .catch(error => {
        console.error('Ошибка:', error);
        alert('Произошла ошибка при обновлении статуса платежа. Пожалуйста, свяжитесь с администратором.');
      });
    }).mount('wm-widget');
  </script>
</body>
</html>
  `;
}

// Эндпоинт для генерации страницы WebMoney виджета
app.get('/payment/webmoney/:paymentId', (req, res) => {
  const paymentId = req.params.paymentId;
  
  // Получаем информацию о платеже
  db.get(
    `SELECT p.amount, p.verification_code, v.plan, u.username
     FROM payments p
     JOIN vds_servers v ON p.id = v.payment_id
     JOIN users u ON p.user_id = u.id
     WHERE p.payment_id = ?`,
    [paymentId],
    (err, payment) => {
      if (err || !payment) {
        return res.redirect('/dashboard.html?payment=error');
      }
      
      const description = `NettyHost VDS (${payment.plan}), код: ${payment.verification_code}`;
      const html = generateWebMoneyWidgetHtml(
        payment.amount,
        paymentId,
        payment.plan,
        description
      );
      
      res.send(html);
    }
  );
});

// Добавляем поддержку WebMoney в функцию создания платежа VDS
// Обновляем функцию обработки покупки VDS для использования WebMoney
app.post('/api/vds/purchase', authMiddleware, async (req, res) => {
  const { plan, paymentMethod } = req.body;
  const userId = req.session.user.id;
  
  console.log(`Создание заказа VDS плана ${plan} для пользователя ${userId}, метод оплаты: ${paymentMethod || 'robokassa'}`);
  
  // Определение цены плана
  let amount = 0;
  switch(plan) {
    case 'basic':
      amount = 300;
      break;
    case 'standard':
      amount = 600;
      break;
    case 'premium':
      amount = 1200;
      break;
    default:
      console.error(`Неверный план: ${plan}`);
      return res.status(400).json({ 
        success: false, 
        message: 'Указан несуществующий план' 
      });
  }
  
  // Генерация уникального ID платежа и кода для проверки
  const paymentId = `payment_vds_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const verificationCode = `VDS${Math.floor(10000 + Math.random() * 90000)}`; // 5-значный код с префиксом VDS
  
  console.log(`Сгенерирован код верификации: ${verificationCode}`);
  
  try {
    // Сохранение информации о платеже в БД
    db.run(
      'INSERT INTO payments (user_id, amount, payment_id, status, verification_code) VALUES (?, ?, ?, ?, ?)',
      [userId, amount, paymentId, 'pending', verificationCode],
      async function(err) {
        if (err) {
          console.error('Ошибка при создании платежа:', err);
          return res.status(500).json({ 
            success: false, 
            message: 'Ошибка при создании платежа' 
          });
        }
        
        const paymentDbId = this.lastID;
        console.log(`Создан платеж с ID ${paymentDbId} в базе данных`);
        
        // Создание записи о VDS сервере
        db.run(
          'INSERT INTO vds_servers (user_id, plan, status, payment_id) VALUES (?, ?, ?, ?)',
          [userId, plan, 'pending', paymentDbId],
          async function(err) {
            if (err) {
              console.error('Ошибка при создании записи о сервере:', err);
              return res.status(500).json({ 
                success: false, 
                message: 'Ошибка при создании записи о сервере' 
              });
            }
            
            const vdsId = this.lastID;
            console.log(`Создан VDS сервер с ID ${vdsId} в базе данных`);
            
            try {
              let paymentUrl = '';
              const paymentMethodToUse = paymentMethod || 'robokassa';
              
              // Выбор платежной системы
              if (paymentMethodToUse === 'webmoney') {
                // Для WebMoney создаем специальную страницу с виджетом
                paymentUrl = `/payment/webmoney/${paymentId}`;
              } else {
                // По умолчанию используем RoboKassa
                const roboPayment = await createRobokassaPayment(
                  amount,
                  paymentId,
                  `Оплата VDS плана ${plan}, код: ${verificationCode}`
                );
                paymentUrl = roboPayment.payUrl;
              }
              
              // Запускаем проверку платежа в фоне
              startPaymentVerification(verificationCode, paymentId, vdsId, plan, userId);
              
              res.status(200).json({
                success: true,
                message: 'Заказ VDS сервера создан',
                payment_id: paymentId,
                verification_code: verificationCode,
                vds_id: vdsId,
                payment_url: paymentUrl,
                payment_method: paymentMethodToUse
              });
            } catch (error) {
              console.error('Ошибка при создании платежа:', error);
              
              // Даже если платеж не создался, отправляем ответ с инфо для ручной проверки
              res.status(200).json({
                success: true,
                message: 'Заказ VDS сервера создан, но возникла проблема с платежной системой',
                payment_id: paymentId,
                verification_code: verificationCode,
                vds_id: vdsId,
                error: 'Не удалось создать автоматический платеж. Пожалуйста, свяжитесь с администратором через Telegram.'
              });
            }
          }
        );
      }
    );
  } catch (error) {
    console.error('Ошибка при создании заказа:', error);
    res.status(500).json({
      success: false,
      message: 'Внутренняя ошибка сервера'
    });
  }
}); 

// Функция для создания платежа YooMoney
async function createYooMoneyPayment(amount, paymentId, description) {
  try {
    // YooMoney API не требует сложных запросов для формы формы оплаты
    // Мы формируем URL на страницу оплаты с нужными параметрами
    const yoomoneyUrl = `https://yoomoney.ru/quickpay/confirm.xml?receiver=${YOOMONEY_WALLET}&quickpay-form=donate&targets=${encodeURIComponent(description)}&paymentType=AC&sum=${amount}&label=${paymentId}`;
    
    console.log(`Создан платеж YooMoney: ${paymentId}, сумма: ${amount} ₽`);
    
    return {
      success: true,
      payment_url: yoomoneyUrl,
      payment_id: paymentId
    };
  } catch (error) {
    console.error('Ошибка при создании платежа YooMoney:', error);
    return {
      success: false,
      error: 'Ошибка при создании платежа YooMoney'
    };
  }
}

// Функция для проверки статуса платежа YooMoney
async function checkYooMoneyPayment(paymentId) {
  try {
    // В реальной реализации здесь будет проверка через API YooMoney
    // Однако, поскольку YooMoney не предоставляет прямой API для проверки платежей по label,
    // мы полагаемся на webhook уведомления и проверяем статус в нашей базе данных
    
    return new Promise((resolve, reject) => {
      db.get('SELECT status FROM payments WHERE payment_id = ?', [paymentId], (err, payment) => {
        if (err) {
          console.error('Ошибка при проверке статуса платежа YooMoney:', err);
          reject({ 
            success: false, 
            status: { value: 'ERROR' },
            error: 'Ошибка при проверке статуса платежа' 
          });
          return;
        }
        
        if (!payment) {
          reject({ 
            success: false, 
            status: { value: 'NOT_FOUND' },
            error: 'Платеж не найден' 
          });
          return;
        }
        
        let statusValue = 'WAITING';
        
        if (payment.status === 'completed') {
          statusValue = 'PAID';
        } else if (payment.status === 'failed') {
          statusValue = 'FAILED';
        }
        
        resolve({
          success: true,
          status: { value: statusValue }
        });
      });
    });
  } catch (error) {
    console.error('Ошибка при проверке статуса платежа YooMoney:', error);
    return {
      success: false,
      status: { value: 'ERROR' },
      error: 'Ошибка при проверке статуса платежа'
    };
  }
}

// Эндпоинт для создания платежа для заказа VDS
app.post('/api/vds/order', authMiddleware, async (req, res) => {
  const { plan, payment_method } = req.body;
  const userId = req.session.user.id;
  
  // Проверка валидности плана
  if (!['basic', 'standard', 'premium'].includes(plan)) {
    return res.status(400).json({ 
      success: false, 
      message: 'Неверный план VDS' 
    });
  }
  
  // Определение цены в зависимости от плана
  let amount = 0;
  let planDescription = '';
  
  switch(plan) {
    case 'basic':
      amount = 300;
      planDescription = 'Базовый VDS';
      break;
    case 'standard':
      amount = 600;
      planDescription = 'Стандартный VDS';
      break;
    case 'premium':
      amount = 1200;
      planDescription = 'Премиум VDS';
      break;
  }
  
  // Генерация уникального ID платежа
  const paymentId = `payment_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const verificationCode = crypto.randomBytes(3).toString('hex').toUpperCase();
  
  try {
    // Создание записи о платеже в БД
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO payments (user_id, amount, payment_id, status, verification_code) VALUES (?, ?, ?, ?, ?)',
        [userId, amount, paymentId, 'pending', verificationCode],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
    
    // Создание VDS сервера
    const vdsId = await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO vds_servers (user_id, plan, status, payment_id) VALUES (?, ?, ?, (SELECT id FROM payments WHERE payment_id = ?))',
        [userId, plan, 'pending', paymentId],
        function(err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });
    
    // Формирование описания платежа
    const description = `Оплата VDS ${planDescription}`;
    
    // Создание платежа YooMoney
    const paymentResult = await createYooMoneyPayment(amount, paymentId, description);
    
    if (!paymentResult.success) {
      return res.status(500).json({ 
        success: false, 
        message: 'Ошибка при создании платежа' 
      });
    }
    
    // Запуск процесса проверки платежа
    startPaymentVerification(verificationCode, paymentId, vdsId, plan, userId);
    
    return res.status(200).json({
      success: true,
      message: 'Заказ создан',
      vds_id: vdsId,
      payment_id: paymentId,
      verification_code: verificationCode,
      redirect_url: paymentResult.payment_url
    });
  } catch (error) {
    console.error('Ошибка при создании заказа VDS:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Ошибка при создании заказа' 
    });
  }
});