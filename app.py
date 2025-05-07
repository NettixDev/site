from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_bcrypt import Bcrypt
from flask_session import Session
import os
import telebot
import secrets
import string
import json
import requests
from datetime import datetime, timedelta
import threading
import time
from yoomoney import Quickpay, Client
import urllib.parse

# Инициализация приложения
app = Flask(__name__, static_folder='.', static_url_path='')
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'nettyhost-secret-key-for-flask')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///nettyhost.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SESSION_TYPE'] = 'filesystem'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)  # Увеличиваем время жизни сессии до 7 дней
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'  # Устанавливаем SameSite=Lax для лучшей безопасности
app.config['SESSION_COOKIE_SECURE'] = True  # Требуем использование cookie только с HTTPS
app.config['SESSION_COOKIE_HTTPONLY'] = True  # Запрещаем доступ к cookie через JavaScript
app.config['SESSION_USE_SIGNER'] = True  # Подписываем cookie для повышения безопасности
app.config['REMEMBER_COOKIE_DURATION'] = timedelta(days=30)  # Устанавливаем время жизни cookie remember me
app.config['REMEMBER_COOKIE_SAMESITE'] = 'Lax'  # То же самое для cookie remember me

# Базовый URL для ссылок
BASE_URL = 'https://nettyhost.pro'

# Настройки ЮMoney
YOOMONEY_WALLET = os.environ.get('YOOMONEY_WALLET', '4100119127110327')
YOOMONEY_TOKEN = os.environ.get('YOOMONEY_TOKEN', '4100119030585483.6498E7D77972FC8D806D0DC58588FFD770F8BCB3A6A18004D5BB9E85560FB94732A40486BD7755606A4305EBA4AAC6E389B11ED36F56FA427071590FA8419C5C2B15AE0E230B49FD3F91ED16FEED31167470633F8857CE446DAD8CD027C289CE13A0C55422CE49A7C221DB9ECFEB865137F2256D659BB80BCD88AFDB9171AC44')
YOOMONEY_CLIENT_ID = os.environ.get('YOOMONEY_CLIENT_ID', 'E9913C07C6BD4EDDA6CAC15EA497CBD81593CD94759BDA44FDA0B464DE35CA82')

# Настройки Telegram бота
TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '7763700239:AAFyT-ZkcQ9LLnlAK5NM5aXA4-CYBvkLlwg')
ADMIN_CHAT_IDS = ['8134425598', '6606443997']
ENABLE_TELEGRAM_BOT = True  # Включаем бота для получения уведомлений

# Инициализация расширений
db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
login_manager = LoginManager(app)
login_manager.login_view = 'login_page'  # Исправляем на правильное имя функции
login_manager.login_message = 'Пожалуйста, войдите для доступа к этой странице'
Session(app)

# Инициализация Telegram бота (только если включено)
bot = None
if ENABLE_TELEGRAM_BOT:
    bot = telebot.TeleBot(TELEGRAM_BOT_TOKEN)

# Модели базы данных
class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(100), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    payments = db.relationship('Payment', backref='user', lazy=True)
    vds_servers = db.relationship('VDSServer', backref='user', lazy=True)

class Payment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    payment_id = db.Column(db.String(100), unique=True, nullable=False)
    status = db.Column(db.String(20), default='pending')
    verification_code = db.Column(db.String(20))
    transaction_id = db.Column(db.String(100))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    vds_servers = db.relationship('VDSServer', backref='payment', lazy=True)

class VDSServer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    plan = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), default='pending')
    payment_id = db.Column(db.Integer, db.ForeignKey('payment.id'))
    access_link = db.Column(db.String(200))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expiration_date = db.Column(db.DateTime, nullable=True)  # Дата окончания пробного периода

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# Проверка авторизации для API
def auth_required_api(f):
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'success': False, 'message': 'Требуется авторизация', 'redirect': '/login.html'}), 401
        return f(*args, **kwargs)
    decorated.__name__ = f.__name__
    return decorated

# Проверка прав администратора для API
def admin_required_api(f):
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated:
            return jsonify({'success': False, 'message': 'Требуется авторизация', 'redirect': '/login.html'}), 401
        if not current_user.is_admin:
            return jsonify({'success': False, 'message': 'Требуются права администратора'}), 403
        return f(*args, **kwargs)
    decorated.__name__ = f.__name__
    return decorated

# Функция для создания платежа в ЮMoney
def create_yoomoney_payment(amount, payment_id, description):
    try:
        # Добавим более подробное описание и комментарий для платежа
        full_description = f"Оплата услуг хостинга NettyHost: {description}"
        
        # Создаем форму для оплаты через Quickpay с базовыми параметрами
        quickpay = Quickpay(
            receiver=YOOMONEY_WALLET,
            quickpay_form="shop",
            targets=full_description,
            paymentType="PC",
            sum=amount,
            label=payment_id,
            successURL=f"{BASE_URL}/payment-success?label={payment_id}"
        )
        
        # Получаем URL для оплаты
        payment_url = quickpay.redirected_url
        
        # Выводим более подробную информацию
        print("=" * 50)
        print(f"Создан платеж ЮMoney (Quickpay):")
        print(f"ID: {payment_id}")
        print(f"Сумма: {amount} ₽")
        print(f"URL платежа: {payment_url}")
        print("=" * 50)
        
        return {
            "success": True,
            "payment_url": payment_url,
            "payment_id": payment_id
        }
    except Exception as e:
        print(f"Ошибка при создании платежа ЮMoney: {e}")
        return {
            "success": False,
            "error": f"Ошибка при создании платежа ЮMoney: {e}"
        }

# Функция для проверки статуса платежа ЮMoney через API
def check_yoomoney_payment_status(payment_id):
    try:
        # Реальная проверка через API
        if YOOMONEY_TOKEN:
            client = Client(YOOMONEY_TOKEN)
            # Проверяем историю операций по label (payment_id)
            history = client.operation_history(label=payment_id)
            
            for operation in history.operations:
                if operation.label == payment_id and operation.status == "success":
                    return {
                        "success": True,
                        "status": "PAID",
                        "transaction_id": operation.operation_id,
                        "amount": operation.amount
                    }
            
            # Платеж не найден или не успешен
            return {
                "success": True,
                "status": "WAITING"
            }
        else:
            # Если токена нет, используем статус из базы данных
            payment = Payment.query.filter_by(payment_id=payment_id).first()
            
            if not payment:
                return {
                    "success": False,
                    "status": "NOT_FOUND",
                    "error": "Платеж не найден"
                }
            
            status = "WAITING"
            if payment.status == "completed":
                status = "PAID"
            elif payment.status == "failed":
                status = "FAILED"
            
            return {
                "success": True,
                "status": status
            }
    except Exception as e:
        print(f"Ошибка при проверке статуса платежа ЮMoney: {e}")
        return {
            "success": False,
            "status": "ERROR",
            "error": f"Ошибка при проверке статуса платежа: {e}"
        }

# Функция для запуска периодической проверки платежей
def start_payment_verification(verification_code, payment_id, vds_id, plan, user_id):
    def verification_process():
        tries = 0
        max_tries = 60  # 30 минут при проверке каждые 30 секунд
        
        while tries < max_tries:
            tries += 1
            
            try:
                # Проверка статуса платежа
                payment_status = check_yoomoney_payment_status(payment_id)
                
                if payment_status["success"] and payment_status["status"] == "PAID":
                    # Платеж успешен - обновляем статус
                    payment = Payment.query.filter_by(payment_id=payment_id).first()
                    
                    if payment and payment.status != "completed":
                        payment.status = "completed"
                        
                        if "transaction_id" in payment_status:
                            payment.transaction_id = payment_status["transaction_id"]
                        
                        # Не меняем статус VDS сервера, оставляем его в pending
                        # для ручной активации администратором
                        vds_server = VDSServer.query.get(vds_id)
                        
                        # Просто сохраняем изменения в БД
                        db.session.commit()
                            
                        # Получаем данные пользователя
                        user = User.query.get(user_id)
                        
                        # Отправляем уведомление администратору через Telegram, если бот включен
                        if ENABLE_TELEGRAM_BOT and bot:
                            for admin_chat_id in ADMIN_CHAT_IDS:
                                try:
                                    message_text = f"✅ Платеж за VDS успешно получен!\n\n" \
                                                  f"ID сервера: #{vds_id}\n" \
                                                  f"План: {plan}\n" \
                                                  f"Сумма: {payment.amount} ₽\n" \
                                                  f"Пользователь: {user.username if user else 'неизвестно'}\n" \
                                                  f"Email: {user.email if user else 'неизвестно'}\n\n" \
                                                  f"⚠️ Сервер ожидает активации.\n" \
                                                  f"Для активации и установки ссылки доступа используйте команду:\n" \
                                                  f"/setlink {vds_id} {BASE_URL}/vds/{vds_id}"
                                    
                                    bot.send_message(admin_chat_id, message_text)
                                except Exception as e:
                                    print(f"Ошибка отправки сообщения админу {admin_chat_id}: {e}")
                        else:
                            print(f"✅ Платеж получен!\nID: {vds_id}\nПлан: {plan}\nСумма: {payment.amount} ₽\nКод верификации: {verification_code}")
                        
                        print(f"Платеж {payment_id} успешно завершен!")
                        return  # Завершаем проверку
                
                # Ждем 30 секунд до следующей проверки
                time.sleep(30)
            except Exception as e:
                print(f"Ошибка при проверке платежа {payment_id}: {e}")
                time.sleep(30)
        
        print(f"Проверка платежа {payment_id} завершена по тайм-ауту.")
    
    # Запускаем проверку в отдельном потоке с низким приоритетом
    thread = threading.Thread(target=verification_process, daemon=True)
    thread.start()
    print(f"Фоновая проверка платежа {payment_id} запущена")

# Маршруты приложения
@app.route('/')
def index():
    # Проверка наличия index.html в статической директории
    try:
        return app.send_static_file('index.html')
    except Exception as e:
        print(f"Ошибка при загрузке index.html: {e}")
        return "Ошибка при загрузке главной страницы", 500

@app.route('/register.html')
def register_page():
    return app.send_static_file('register.html')

@app.route('/login.html')
def login_page():
    return app.send_static_file('login.html')

@app.route('/dashboard.html')
@login_required
def dashboard_page():
    return app.send_static_file('dashboard.html')

@app.route('/test-payment.html')
@login_required
def test_payment_page():
    return app.send_static_file('test-payment.html')

# API для регистрации
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    email = data.get('email')
    password = data.get('password')
    
    if not username or not email or not password:
        return jsonify({'success': False, 'message': 'Все поля обязательны для заполнения'}), 400
    
    # Проверка уникальности имени пользователя и email
    if User.query.filter_by(username=username).first():
        return jsonify({'success': False, 'message': 'Пользователь с таким именем уже существует'}), 400
    
    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'message': 'Пользователь с таким email уже существует'}), 400
    
    # Хеширование пароля и создание пользователя
    hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
    user = User(username=username, email=email, password=hashed_password, is_admin=False)
    
    db.session.add(user)
    db.session.commit()
    
    # Авторизация пользователя
    login_user(user, remember=True)
    session.permanent = True
    
    # Уведомление администратора через Telegram, если бот включен
    if ENABLE_TELEGRAM_BOT and bot:
        for admin_chat_id in ADMIN_CHAT_IDS:
            try:
                bot.send_message(
                    admin_chat_id,
                    f"🆕 Новая регистрация!\nПользователь: {username}\nEmail: {email}"
                )
            except Exception as e:
                print(f"Ошибка отправки сообщения админу {admin_chat_id}: {e}")
    else:
        print(f"🆕 Новая регистрация!\nПользователь: {username}\nEmail: {email}")
    
    return jsonify({'success': True, 'message': 'Регистрация успешна'})

# API для авторизации
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({'success': False, 'message': 'Все поля обязательны для заполнения'}), 400
    
    # Поиск пользователя
    user = User.query.filter_by(username=username).first()
    
    if not user or not bcrypt.check_password_hash(user.password, password):
        return jsonify({'success': False, 'message': 'Неверное имя пользователя или пароль'}), 401
    
    # Авторизация пользователя
    login_user(user, remember=True)
    session.permanent = True  # Делаем сессию постоянной
    
    return jsonify({'success': True, 'message': 'Авторизация успешна'})

# API для выхода
@app.route('/api/logout', methods=['POST'])
@login_required
def logout():
    logout_user()
    session.clear()  # Очищаем сессию полностью
    return jsonify({'success': True, 'message': 'Выход выполнен'})

# API для заказа VDS
@app.route('/api/vds/order', methods=['POST'])
@login_required
def order_vds():
    data = request.json
    plan = data.get('plan')
    payment_method = data.get('payment_method', 'yoomoney')
    
    # Проверка валидности плана
    if plan not in ['free', 'premium']:
        return jsonify({'success': False, 'message': 'Неверный план VDS'}), 400
    
    # Определение цены в зависимости от плана
    amount = 0
    plan_description = ''
    
    if plan == 'free':
        amount = 0
        plan_description = 'Бесплатный VDS (пробный период на 1 день)'
    elif plan == 'premium':
        amount = 449
        plan_description = 'Премиум VDS'
    
    # Генерация уникального ID платежа и кода верификации
    payment_id = f"payment_{int(time.time())}_{secrets.randbelow(1000)}"
    verification_code = ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(6))
    
    try:
        # Создание записи о платеже
        payment = Payment(
            user_id=current_user.id,
            amount=amount,
            payment_id=payment_id,
            status='pending',  # Все платежи начинаются в статусе pending
            verification_code=verification_code
        )
        db.session.add(payment)
        db.session.flush()  # Получаем ID платежа, не коммитя транзакцию
        
        # Создание VDS сервера
        vds_server = VDSServer(
            user_id=current_user.id,
            plan=plan,
            status='pending',  # Все серверы начинаются в статусе pending
            payment_id=payment.id
        )
        
        # Устанавливаем дату окончания для бесплатного плана (1 день)
        if plan == 'free':
            vds_server.expiration_date = datetime.utcnow() + timedelta(days=1)
        
        # Больше не устанавливаем ссылку доступа автоматически
        db.session.add(vds_server)
        db.session.commit()
        
        # Отправляем уведомление администратору для любого типа плана
        if ENABLE_TELEGRAM_BOT and bot:
            for admin_chat_id in ADMIN_CHAT_IDS:
                try:
                    plan_text = "бесплатный" if plan == "free" else "премиум"
                    message_text = f"🆕 Новый заказ VDS ({plan_text})!\n\n" \
                                  f"ID сервера: #{vds_server.id}\n" \
                                  f"Пользователь: {current_user.username} (ID: {current_user.id})\n" \
                                  f"Email: {current_user.email}\n" \
                                  f"Статус: в ожидании\n\n" \
                                  f"Для активации и установки ссылки доступа используйте команду:\n" \
                                  f"/setlink {vds_server.id} {BASE_URL}/vds/{vds_server.id}"
                    
                    # Если это бесплатный план, добавляем соответствующее примечание
                    if plan == 'free':
                        message_text += "\n\n⚠️ Это бесплатный пробный план на 1 день."
                    
                    bot.send_message(admin_chat_id, message_text)
                except Exception as e:
                    print(f"Ошибка отправки уведомления о новом заказе: {e}")
                    
        # Для бесплатного плана не требуется оплата, но статус остается pending до ручной активации
        if plan == 'free':
            return jsonify({
                'success': True,
                'message': 'Бесплатный пробный сервер (на 1 день) заказан. Ожидайте активации администратором.',
                'vds_id': vds_server.id,
                'payment_id': payment_id,
                'verification_code': verification_code
            })
        
        # Для премиум плана создаем платеж
        # Формирование описания платежа
        description = f"Оплата VDS {plan_description}"
        
        # Создание платежа ЮMoney
        payment_result = create_yoomoney_payment(amount, payment_id, description)
        
        if not payment_result["success"]:
            return jsonify({'success': False, 'message': 'Ошибка при создании платежа'}), 500
        
        # Запуск процесса проверки платежа в фоновом режиме
        # Запускаем после отправки ответа клиенту, чтобы не блокировать запрос
        threading.Thread(
            target=start_payment_verification,
            args=(verification_code, payment_id, vds_server.id, plan, current_user.id),
            daemon=True
        ).start()
        
        return jsonify({
            'success': True,
            'message': 'Заказ создан. После оплаты ожидайте активации сервера администратором.',
            'vds_id': vds_server.id,
            'payment_id': payment_id,
            'verification_code': verification_code,
            'redirect_url': payment_result["payment_url"]
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"Ошибка при создании заказа VDS: {e}")
        return jsonify({'success': False, 'message': f'Ошибка при создании заказа: {e}'}), 500

# API для получения списка VDS серверов
@app.route('/api/vds/list', methods=['GET'])
@login_required
def vds_list():
    try:
        # Получаем все серверы пользователя
        servers = VDSServer.query.filter_by(user_id=current_user.id).all()
        
        servers_data = []
        for server in servers:
            # Проверяем, не истек ли срок действия сервера
            is_expired = False
            remaining_hours = None
            
            if server.expiration_date:
                if server.expiration_date < datetime.utcnow():
                    is_expired = True
                    if server.status == 'active':
                        # Автоматически обновляем статус, если сервер истек
                        server.status = 'expired'
                        db.session.commit()
                else:
                    # Вычисляем оставшееся время в часах
                    time_delta = server.expiration_date - datetime.utcnow()
                    remaining_hours = int(time_delta.total_seconds() / 3600)
            
            server_data = {
                'id': server.id,
                'plan': server.plan,
                'status': server.status,
                'created_at': server.created_at.isoformat(),
                'access_link': server.access_link
            }
            
            # Добавляем информацию о сроке действия, если есть
            if server.expiration_date:
                server_data['expiration_date'] = server.expiration_date.isoformat()
                server_data['is_expired'] = is_expired
                server_data['remaining_hours'] = remaining_hours
            
            servers_data.append(server_data)
        
        return jsonify({'success': True, 'servers': servers_data})
    except Exception as e:
        print(f"Ошибка при получении списка VDS: {e}")
        return jsonify({'success': False, 'message': f'Ошибка при получении списка VDS: {e}'}), 500

# Webhook для ЮMoney уведомлений
@app.route('/api/yoomoney/webhook', methods=['POST'])
def yoomoney_webhook():
    try:
        print("Получено уведомление от YooMoney")
        print(f"POST данные: {request.form}")
        print(f"JSON данные: {request.json if request.is_json else 'Нет JSON данных'}")
        
        # YooMoney может отправлять данные в разных форматах
        # Проверяем сначала form-данные, затем JSON
        if request.form:
            data = request.form
        elif request.is_json:
            data = request.json
        else:
            print("Ошибка: пустые данные в запросе")
            return jsonify({'success': False, 'message': 'Пустые данные в запросе'}), 400
        
        # Получаем необходимые параметры
        operation_id = data.get('operation_id') or data.get('notification_type')
        payment_id = data.get('label') or data.get('operation_id')
        amount = data.get('amount') or data.get('withdrawAmount')
        status = data.get('status') or 'success'  # Предполагаем, что если YooMoney отправил webhook, то платеж успешен
        
        print(f"Платеж: ID={payment_id}, сумма={amount}, статус={status}")
        
        if not payment_id:
            print("Ошибка: отсутствует payment_id в запросе")
            return jsonify({'success': False, 'message': 'Отсутствует payment_id'}), 400
        
        # Обновление статуса платежа
        payment = Payment.query.filter_by(payment_id=payment_id).first()
        
        if not payment:
            print(f"Ошибка: Платеж с ID {payment_id} не найден")
            return jsonify({'success': False, 'message': 'Платеж не найден'}), 404
        
        if payment.status != 'completed' and status == 'success':
            print(f"Обновление статуса платежа {payment_id} на 'completed'")
            payment.status = 'completed'
            if operation_id:
                payment.transaction_id = operation_id
            
            # Обновляем статус VDS сервера
            vds_server = VDSServer.query.filter_by(payment_id=payment.id).first()
            if vds_server:
                print(f"Обновление статуса VDS {vds_server.id} на 'active'")
                vds_server.status = 'active'
                vds_server.access_link = f"{BASE_URL}/vds/{vds_server.id}"
            
            db.session.commit()
            
            # Отправляем уведомление администратору через Telegram, если бот включен
            if ENABLE_TELEGRAM_BOT and bot:
                for admin_chat_id in ADMIN_CHAT_IDS:
                    try:
                        bot.send_message(
                            admin_chat_id,
                            f"✅ Новый оплаченный заказ через webhook!\nID: {vds_server.id if vds_server else 'не определен'}\nСумма: {amount} ₽\nТранзакция: {operation_id}"
                        )
                    except Exception as e:
                        print(f"Ошибка отправки сообщения админу {admin_chat_id}: {e}")
            else:
                print(f"✅ Новый оплаченный заказ через webhook!\nID: {vds_server.id if vds_server else 'не определен'}\nСумма: {amount} ₽\nТранзакция: {operation_id}")
        else:
            print(f"Платеж {payment_id} уже имеет статус '{payment.status}', не требуется обновление")
        
        return jsonify({'success': True, 'message': 'Уведомление обработано'})
    except Exception as e:
        print(f"Ошибка в webhook ЮMoney: {e}")
        return jsonify({'success': False, 'message': f'Ошибка: {e}'}), 500

# Обработка команд Telegram бота
if ENABLE_TELEGRAM_BOT:
    @bot.message_handler(commands=['start'])
    def handle_start(message):
        bot.reply_to(message, "Добро пожаловать в бота NettyHost! Используйте /help для получения списка команд.")

    @bot.message_handler(commands=['help'])
    def handle_help(message):
        help_text = """
Команды бота:
/start - Начать работу с ботом
/help - Показать это сообщение
/status - Проверить статус сервера
/verify <код> - Подтвердить платеж вручную
/setlink <id> <ссылка> - Установить ссылку доступа для VDS
        """
        bot.reply_to(message, help_text)

    @bot.message_handler(commands=['verify'])
    def handle_verify(message):
        # Получаем код верификации из сообщения
        parts = message.text.split()
        if len(parts) < 2:
            bot.reply_to(message, "Укажите код верификации после команды /verify")
            return
        
        verification_code = parts[1].strip().upper()
        
        # Ищем платеж с таким кодом верификации
        payment = Payment.query.filter_by(verification_code=verification_code).first()
        
        if not payment:
            bot.reply_to(message, f"Платеж с кодом {verification_code} не найден")
            return
        
        # Если платеж уже обработан
        if payment.status == 'completed':
            bot.reply_to(message, f"Платеж с кодом {verification_code} уже был подтвержден")
            return
        
        # Обновляем статус платежа
        payment.status = 'completed'
        
        # Обновляем статус VDS сервера
        vds_server = VDSServer.query.filter_by(payment_id=payment.id).first()
        if vds_server:
            vds_server.status = 'active'
            vds_server.access_link = f"{BASE_URL}/vds/{vds_server.id}"
            
            db.session.commit()
            
            # Отправляем уведомление администратору
            for admin_chat_id in ADMIN_CHAT_IDS:
                if str(admin_chat_id) != str(message.chat.id):  # Не отправляем уведомление текущему админу
                    try:
                        bot.send_message(
                            admin_chat_id,
                            f"✅ Заказ подтвержден вручную!\nID: {vds_server.id}\nПлан: {vds_server.plan}\nСумма: {payment.amount} ₽\nПодтвердил: {message.from_user.username or message.from_user.first_name}"
                        )
                    except Exception as e:
                        print(f"Ошибка отправки сообщения админу {admin_chat_id}: {e}")
            
            # Отвечаем на сообщение
            bot.reply_to(message, f"✅ Платеж с кодом {verification_code} успешно подтвержден.\nVDS сервер активирован.")
        else:
            db.session.rollback()
            bot.reply_to(message, f"Ошибка: не найден VDS сервер для платежа {verification_code}")
    
    @bot.message_handler(commands=['setlink'])
    def handle_setlink(message):
        # Проверяем, от админа ли пришла команда
        if str(message.chat.id) not in ADMIN_CHAT_IDS:
            bot.reply_to(message, "❌ У вас нет прав для выполнения этой команды")
            return
        
        # Разбираем аргументы
        parts = message.text.split(maxsplit=2)
        if len(parts) < 3:
            bot.reply_to(message, "⚠️ Укажите ID сервера и ссылку: /setlink <id> <ссылка>")
            return
        
        try:
            server_id = int(parts[1].strip())
            access_link = parts[2].strip()
            
            # Проверяем, что ссылка выглядит правильно
            if not access_link.startswith("http"):
                bot.reply_to(message, "⚠️ Ссылка должна начинаться с http:// или https://")
                return
            
            # Находим сервер и устанавливаем ссылку
            with app.app_context():
                server = VDSServer.query.get(server_id)
                if not server:
                    bot.reply_to(message, f"❌ Сервер с ID {server_id} не найден")
                    return
                
                # Сохраняем старую ссылку и статус для отчета
                old_link = server.access_link
                old_status = server.status
                
                # Устанавливаем новую ссылку и активируем сервер
                server.access_link = access_link
                server.status = 'active'
                db.session.commit()
                
                # Получаем информацию о пользователе
                user = User.query.get(server.user_id)
                
                # Формируем отчет об изменениях
                status_changed = old_status != 'active'
                status_text = "Статус изменен: pending → active" if status_changed else "Статус не изменен (уже был active)"
                
                # Проверяем, есть ли срок действия и добавляем информацию
                expiration_info = ""
                if server.plan == 'free' and server.expiration_date:
                    time_left = server.expiration_date - datetime.utcnow()
                    hours_left = int(time_left.total_seconds() / 3600)
                    
                    if time_left.total_seconds() > 0:
                        expiration_info = f"\n⏱️ Пробный период: {hours_left} ч. до {server.expiration_date.strftime('%d.%m.%Y %H:%M')}"
                    else:
                        expiration_info = f"\n⚠️ Пробный период истек: {server.expiration_date.strftime('%d.%m.%Y %H:%M')}"
                
                # Отвечаем успехом
                bot.reply_to(message, 
                    f"✅ Сервер #{server_id} активирован!\n\n"
                    f"{status_text}\n"
                    f"Старая ссылка: {old_link or 'отсутствует'}\n"
                    f"Новая ссылка: {access_link}\n\n"
                    f"План: {server.plan}{expiration_info}"
                )
                
                # Отправляем информацию о пользователе для справки
                if user:
                    bot.send_message(
                        message.chat.id,
                        f"📋 Информация о пользователе:\nID: {user.id}\nИмя: {user.username}\nEmail: {user.email}"
                    )
        except ValueError:
            bot.reply_to(message, "❌ ID сервера должен быть числом")
        except Exception as e:
            bot.reply_to(message, f"❌ Ошибка при активации сервера: {str(e)}")
            print(f"Ошибка в команде setlink: {e}")

# Запуск Telegram бота в отдельном потоке
if ENABLE_TELEGRAM_BOT:
    def run_bot():
        try:
            print("Запуск Telegram-бота...")
            
            # Удаляем webhook перед запуском polling
            try:
                bot.delete_webhook()
                print("Webhook успешно удален")
            except Exception as e:
                print(f"Ошибка при удалении webhook: {e}")
            
            # Устанавливаем прослушивание сообщений с обработкой конфликтов
            try:
                bot.polling(none_stop=True, timeout=60, interval=3)
            except Exception as e:
                print(f"Ошибка в работе Telegram бота: {e}")
                time.sleep(10)  # Ждем 10 секунд перед повторной попыткой
                run_bot()  # Рекурсивный вызов для перезапуска
        except Exception as e:
            print(f"Критическая ошибка в работе Telegram бота: {e}")

    # Запуск бота только при непосредственном запуске app.py, а не при импорте
    if __name__ == '__main__':
        bot_thread = threading.Thread(target=run_bot)
        bot_thread.daemon = True
        
        # Сохраняем поток в приложении для возможности управления им
        app.bot_thread = bot_thread
        
        # Запускаем поток
        bot_thread.start()
        print("Telegram-бот запущен в отдельном потоке.")
    else:
        print("Telegram-бот не запущен (модуль импортирован, а не запущен напрямую).")
else:
    print("Telegram-бот отключен в настройках.")

# Создание базы данных и запуск приложения
with app.app_context():
    try:
        db.create_all()
        
        # Проверка наличия админа в базе
        admin = User.query.filter_by(username='admin').first()
        if not admin:
            # Создаем админа с паролем "admin"
            hashed_password = bcrypt.generate_password_hash('admin').decode('utf-8')
            admin = User(username='admin', email='admin@nettyhost.ru', password=hashed_password)
            db.session.add(admin)
            db.session.commit()
            print("Создан админ пользователь: admin/admin")
        
        print("База данных инициализирована успешно.")
    except Exception as e:
        print(f"Ошибка при инициализации базы данных: {e}")

# Обработка CORS
@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
    return response

# Обработка ошибок API
@app.errorhandler(404)
def page_not_found(e):
    if request.path.startswith('/api/'):
        return jsonify({'success': False, 'message': 'API-эндпоинт не найден'}), 404
    return app.send_static_file('index.html')

@app.errorhandler(500)
def server_error(e):
    if request.path.startswith('/api/'):
        return jsonify({'success': False, 'message': 'Внутренняя ошибка сервера'}), 500
    return app.send_static_file('index.html')

# API для получения данных пользователя
@app.route('/api/user', methods=['GET'])
@login_required
def get_user_info():
    try:
        user_data = {
            'id': current_user.id,
            'username': current_user.username,
            'email': current_user.email,
            'is_admin': current_user.is_admin,
            'created_at': current_user.created_at.isoformat()
        }
        return jsonify({'success': True, 'user': user_data})
    except Exception as e:
        print(f"Ошибка при получении данных пользователя: {e}")
        return jsonify({'success': False, 'message': 'Ошибка при получении данных пользователя'}), 500

# Обработчик успешной оплаты
@app.route('/payment-success', methods=['GET'])
def payment_success():
    # Получаем параметры из запроса
    label = request.args.get('label')  # payment_id
    
    print("====== PAYMENT SUCCESS CALLBACK ======")
    print(f"URL: {request.url}")
    print(f"Payment ID: {label}")
    print(f"Args: {request.args}")
    print(f"Headers: {request.headers}")
    print("=====================================")
    
    if not label:
        print("❌ Ошибка: label отсутствует в запросе")
        return app.send_static_file('payment-error.html')
    
    try:
        # Находим платеж в базе
        payment = Payment.query.filter_by(payment_id=label).first()
        
        if not payment:
            print(f"❌ Ошибка: платеж с ID {label} не найден в базе")
            return app.send_static_file('payment-error.html')
        
        print(f"Найден платеж: ID={payment.id}, payment_id={payment.payment_id}, status={payment.status}")
        
        # Просто отображаем страницу успеха без блокирующей проверки
        # Фоновый процесс все равно проверит статус платежа
        return app.send_static_file('payment-success.html')
        
    except Exception as e:
        print(f"❌ Ошибка при обработке успешного платежа: {e}")
        import traceback
        traceback.print_exc()
        return app.send_static_file('payment-error.html')

# Альтернативный обработчик успешной оплаты (с косой чертой вместо дефиса)
@app.route('/payment/success', methods=['GET'])
def payment_success_alt():
    # Просто перенаправляем на основной обработчик со всеми параметрами
    return redirect(url_for('payment_success', **request.args))

# API для проверки статуса платежа
@app.route('/api/payments/<payment_id>/status', methods=['GET'])
def check_payment_status(payment_id):
    try:
        # Проверяем статус платежа через API YooMoney
        payment_status = check_yoomoney_payment_status(payment_id)
        
        if not payment_status["success"]:
            return jsonify({
                'success': False, 
                'status': payment_status.get("status", "ERROR"), 
                'message': payment_status.get("error", "Ошибка при проверке статуса")
            }), 404
        
        # Находим платеж в базе
        payment = Payment.query.filter_by(payment_id=payment_id).first()
        
        if not payment:
            return jsonify({
                'success': False, 
                'status': 'NOT_FOUND', 
                'message': 'Платеж не найден'
            }), 404
        
        # Если платеж успешен, обновляем статус в базе
        if payment_status["status"] == "PAID" and payment.status != "completed":
            payment.status = "completed"
            if "transaction_id" in payment_status:
                payment.transaction_id = payment_status["transaction_id"]
                
            # Обновляем статус VDS сервера
            vds_server = VDSServer.query.filter_by(payment_id=payment.id).first()
            if vds_server:
                vds_server.status = "active"
                vds_server.access_link = f"{BASE_URL}/vds/{vds_server.id}"
                
            db.session.commit()
        
        # Пробуем получить информацию о VDS сервере
        vds_server = VDSServer.query.filter_by(payment_id=payment.id).first()
        vds_info = None
        
        if vds_server:
            vds_info = {
                'id': vds_server.id,
                'plan': vds_server.plan,
                'status': vds_server.status,
                'access_link': vds_server.access_link,
                'created_at': vds_server.created_at.isoformat()
            }
        
        return jsonify({
            'success': True,
            'status': payment_status["status"],
            'payment': {
                'id': payment.id,
                'payment_id': payment.payment_id,
                'amount': payment.amount,
                'status': payment.status,
                'created_at': payment.created_at.isoformat()
            },
            'vds': vds_info
        })
        
    except Exception as e:
        print(f"Ошибка при проверке статуса платежа: {e}")
        return jsonify({'success': False, 'message': f'Ошибка: {e}'}), 500

# Маршрут для прямого перехода к оплате (аварийный вариант)
@app.route('/direct-payment/<payment_id>')
def direct_payment(payment_id):
    try:
        # Находим платеж в базе
        payment = Payment.query.filter_by(payment_id=payment_id).first()
        
        if not payment:
            return "Платеж не найден", 404
        
        # Получаем информацию о VDS сервере
        vds_server = VDSServer.query.filter_by(payment_id=payment.id).first()
        
        if not vds_server:
            return "Сервер VDS не найден", 404
            
        # Получаем описание плана
        plan_descriptions = {
            'basic': 'Базовый VDS',
            'standard': 'Стандартный VDS',
            'premium': 'Премиум VDS'
        }
        plan_description = plan_descriptions.get(vds_server.plan, 'VDS')
        
        # Создаем новую ссылку на оплату
        description = f"Оплата VDS {plan_description}"
        payment_result = create_yoomoney_payment(payment.amount, payment_id, description)
        
        if not payment_result["success"]:
            return "Ошибка при создании ссылки на оплату", 500
            
        # Перенаправляем на страницу оплаты
        return redirect(payment_result["payment_url"])
        
    except Exception as e:
        print(f"Ошибка при создании прямой ссылки на оплату: {e}")
        return f"Ошибка: {str(e)}", 500

# API для ручного подтверждения платежа (для тестирования)
@app.route('/api/payments/<payment_id>/manual-approve', methods=['POST'])
@admin_required_api
def manual_approve_payment(payment_id):
    try:
        # Находим платеж в базе
        payment = Payment.query.filter_by(payment_id=payment_id).first()
        
        if not payment:
            return jsonify({
                'success': False, 
                'message': 'Платеж не найден'
            }), 404
        
        # Обновляем статус платежа
        if payment.status != 'completed':
            payment.status = 'completed'
            payment.transaction_id = f"manual_{payment_id}_{int(time.time())}"
            
            # Обновляем статус VDS сервера
            vds_server = VDSServer.query.filter_by(payment_id=payment.id).first()
            if vds_server:
                vds_server.status = 'active'
                vds_server.access_link = f"{BASE_URL}/vds/{vds_server.id}"
                
            db.session.commit()
            
            print(f"✅ Платеж {payment_id} вручную подтвержден администратором")
            
            return jsonify({
                'success': True,
                'message': 'Платеж успешно подтвержден вручную'
            })
        else:
            return jsonify({
                'success': True,
                'message': 'Платеж уже был подтвержден ранее'
            })
            
    except Exception as e:
        print(f"Ошибка при ручном подтверждении платежа: {e}")
        return jsonify({'success': False, 'message': f'Ошибка: {e}'}), 500

if __name__ == '__main__':
    try:
        print(f"Запуск Flask-приложения на {BASE_URL}...")
        
        # Если порт 80 недоступен, попробуем запустить на 3000
        try:
            app.run(host='0.0.0.0', port=80, debug=False, threaded=True)
        except Exception as e:
            print(f"Ошибка при запуске на порту 80: {e}")
            print("Попытка запуска на порту 3000...")
            app.run(host='0.0.0.0', port=3000, debug=False, threaded=True)
    except Exception as e:
        print(f"Ошибка при запуске Flask-приложения: {e}") 