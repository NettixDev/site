#!/bin/bash

# Скрипт для развертывания приложения NettyHost на сервере

# Установка необходимых зависимостей
echo "Установка зависимостей..."
pip install -r requirements.txt

# Проверка существования базы данных
if [ ! -f "instance/nettyhost.db" ]; then
    echo "Инициализация базы данных..."
    python -c "from app import app, db; app.app_context().push(); db.create_all()"
fi

# Запуск Telegram-бота отдельным процессом
echo "Запуск Telegram-бота..."
python bot_runner.py &

# Запуск приложения через gunicorn
echo "Запуск Flask-приложения через gunicorn..."
gunicorn --bind 0.0.0.0:80 --workers 4 --threads 2 wsgi:application

# Для остановки всех процессов:
# pkill -f "python bot_runner.py"
# pkill -f "gunicorn" 