#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Скрипт для исправления конфликтов Telegram-бота
"""

import os
import sys
import requests
import time
import subprocess
import signal
import psutil

def kill_running_bots():
    """Завершает все запущенные экземпляры бота"""
    print("Завершение запущенных экземпляров бота...")
    
    # Ищем процессы с названием python, содержащие app.py или bot_runner.py
    for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
        try:
            cmdline = ' '.join(proc.info['cmdline'] or [])
            
            # Проверяем, что это процесс Python, запускающий наш бот
            if 'python' in proc.info['name'].lower() and ('app.py' in cmdline or 'bot_runner.py' in cmdline):
                print(f"Найден процесс {proc.info['pid']}: {cmdline}")
                
                # Завершаем процесс
                try:
                    os.kill(proc.info['pid'], signal.SIGTERM)
                    print(f"✅ Процесс {proc.info['pid']} успешно завершен")
                except Exception as e:
                    print(f"❌ Ошибка при завершении процесса {proc.info['pid']}: {e}")
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess) as e:
            print(f"Ошибка при проверке процесса: {e}")

def reset_telegram_webhook(bot_token):
    """Сбрасывает webhook Telegram-бота"""
    print(f"\nСброс webhook для бота...")
    
    try:
        # URL для сброса webhook
        url = f"https://api.telegram.org/bot{bot_token}/deleteWebhook"
        
        # Выполняем запрос
        response = requests.get(url)
        
        # Проверяем ответ
        if response.status_code == 200:
            result = response.json()
            if result.get('ok'):
                print("✅ Webhook успешно сброшен")
            else:
                print(f"❌ Ошибка при сбросе webhook: {result.get('description')}")
        else:
            print(f"❌ Ошибка запроса: {response.status_code} {response.reason}")
    
    except Exception as e:
        print(f"❌ Ошибка при сбросе webhook: {e}")

def main():
    print("=== Скрипт для исправления конфликтов Telegram-бота ===")
    
    # Сначала завершаем все запущенные экземпляры бота
    kill_running_bots()
    
    # Сбрасываем webhook бота
    from app import TELEGRAM_BOT_TOKEN
    reset_telegram_webhook(TELEGRAM_BOT_TOKEN)
    
    print("\n=== Конфликты Telegram-бота устранены ===")
    print("Теперь вы можете запустить приложение заново командой:")
    print("python app.py")
    
    # Ждем 2 секунды перед завершением
    time.sleep(2)

if __name__ == "__main__":
    main() 