#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Скрипт для запуска Telegram-бота отдельным процессом.
Используется в production-окружении для избежания конфликтов с WSGI.
"""

import time
import sys
import logging
from app import app, bot, ENABLE_TELEGRAM_BOT

# Настройка логирования
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('bot.log')
    ]
)

logger = logging.getLogger(__name__)

def main():
    """Основная функция для запуска бота."""
    if not ENABLE_TELEGRAM_BOT:
        logger.warning("Telegram-бот отключен в настройках. Завершение работы.")
        return
    
    if not bot:
        logger.error("Бот не инициализирован. Проверьте токен и настройки.")
        return
    
    try:
        logger.info("Удаление webhook...")
        bot.delete_webhook()
        
        logger.info("Запуск Telegram-бота...")
        bot.polling(none_stop=True, interval=1, timeout=60)
    except Exception as e:
        logger.error(f"Ошибка при запуске бота: {e}")
        # Ждем и пробуем снова
        time.sleep(10)
        main()

if __name__ == "__main__":
    # Перед запуском выведем информацию
    logger.info(f"Запуск бота для токена: {ENABLE_TELEGRAM_BOT}")
    logger.info(f"База данных: {app.config['SQLALCHEMY_DATABASE_URI']}")
    
    with app.app_context():
        main() 