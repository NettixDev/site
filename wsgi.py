#!/usr/bin/env python3
# wsgi.py - файл для запуска приложения через WSGI-совместимый сервер

import os
import sys
import logging
import threading

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('wsgi')

# Добавляем текущую директорию в путь поиска модулей
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
logger.info(f"Текущая директория: {os.getcwd()}")

# Глобальная переменная для хранения экземпляра приложения
application = None

# Значения по умолчанию в случае ошибки импорта
ENABLE_TELEGRAM_BOT = False
bot = None
TELEGRAM_BOT_TOKEN = None

try:
    # Импортируем приложение Flask из модуля app
    from app import app as application
    logger.info("Приложение Flask успешно импортировано")
    
    # Проверяем наличие переменных окружения
    if 'SECRET_KEY' not in os.environ:
        logger.warning("SECRET_KEY не задан в переменных окружения, используется значение по умолчанию")
    
    # Инициализируем базу данных
    with application.app_context():
        from app import db
        try:
            db.create_all()
            logger.info("База данных успешно инициализирована")
        except Exception as e:
            logger.error(f"Ошибка при инициализации базы данных: {e}")
    
    # Правильная обработка Telegram-бота
    # Бот запускается только при прямом запуске, не через WSGI
    from app import ENABLE_TELEGRAM_BOT, bot, TELEGRAM_BOT_TOKEN
    
    if __name__ != "__main__" and ENABLE_TELEGRAM_BOT and hasattr(application, 'bot_thread'):
        # Для WSGI режима не запускаем бота в рамках приложения
        logger.info("WSGI режим: Telegram-бот не будет запущен в рамках этого процесса")
        if hasattr(application.bot_thread, 'is_alive') and application.bot_thread.is_alive():
            logger.info("Останавливаем существующий поток бота")
            # Безопасная остановка потока бота если он запущен
            application.bot_thread._stop = True
    
except ImportError as e:
    logger.error(f"Ошибка импорта: {e}")
    logger.info("Файлы в директории:")
    for file in os.listdir("."):
        logger.info(f" - {file}")
    
    # Создаем базовое приложение для отображения ошибки
    from flask import Flask, jsonify
    application = Flask(__name__)
    
    @application.route('/')
    def error_page():
        return jsonify({"error": "Application failed to start", "details": str(e)}), 500
    
except Exception as e:
    logger.error(f"Ошибка при запуске приложения: {e}")
    import traceback
    logger.error(traceback.format_exc())
    
    # Создаем базовое приложение для отображения ошибки
    from flask import Flask, jsonify
    application = Flask(__name__)
    
    @application.route('/')
    def error_page():
        return jsonify({"error": "Application failed to start", "details": str(e)}), 500

# Функция для запуска бота в отдельном процессе
def start_bot_process():
    if ENABLE_TELEGRAM_BOT and bot and TELEGRAM_BOT_TOKEN:
        logger.info("Запуск Telegram-бота в отдельном процессе")
        from app import run_bot
        run_bot()

# Инструкции по запуску приложения
"""
Для запуска через gunicorn:
gunicorn --bind 0.0.0.0:80 wsgi:application

Для запуска через uwsgi:
uwsgi --socket 0.0.0.0:80 --protocol=http --wsgi-file wsgi.py --callable application

Для запуска с nginx:
uwsgi --socket /tmp/nettyhost.sock --wsgi-file wsgi.py --callable application --chmod-socket=666
"""

# Если файл запускается напрямую
if __name__ == "__main__":
    logger.info("Запуск приложения в режиме разработки...")
    
    # Запускаем бота в отдельном потоке при прямом запуске
    if ENABLE_TELEGRAM_BOT and bot and TELEGRAM_BOT_TOKEN:
        bot_thread = threading.Thread(target=start_bot_process)
        bot_thread.daemon = True
        bot_thread.start()
        logger.info("Telegram-бот запущен в отдельном потоке")
    
    # Запускаем Flask-приложение
    application.run(host="0.0.0.0", port=4678, debug=True)
