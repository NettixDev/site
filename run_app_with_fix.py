#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Скрипт для запуска приложения с исправлениями базы данных
"""

import os
import sys
import time
import subprocess
from app import app, db, User, bcrypt

def init_database():
    """Инициализирует базу данных и проверяет наличие основных пользователей"""
    with app.app_context():
        # Убеждаемся, что таблицы созданы
        db.create_all()
        
        # Проверяем наличие admin
        admin = User.query.filter_by(username='admin').first()
        if not admin:
            print("Создание пользователя admin...")
            hashed_password = bcrypt.generate_password_hash('admin').decode('utf-8')
            admin = User(
                username='admin',
                email='admin@nettyhost.ru',
                password=hashed_password,
                is_admin=True  # Явно устанавливаем права администратора
            )
            db.session.add(admin)
            db.session.commit()
            print("✅ Пользователь admin создан")
        else:
            # Убеждаемся, что пользователь admin имеет правильные права
            if not admin.is_admin:
                admin.is_admin = True
                db.session.commit()
                print("✅ Права администратора установлены для пользователя admin")
        
        # Проверяем наличие NettixDev
        nettix = User.query.filter_by(username='NettixDev').first()
        if not nettix:
            print("Создание пользователя NettixDev...")
            hashed_password = bcrypt.generate_password_hash('nettix').decode('utf-8')
            nettix = User(
                username='NettixDev',
                email='nettixdev@nettyhost.ru',
                password=hashed_password,
                is_admin=False
            )
            db.session.add(nettix)
            db.session.commit()
            print("✅ Пользователь NettixDev создан")
        
        # Проверка наличия тестового пользователя
        test = User.query.filter_by(username='test').first()
        if not test:
            print("Создание тестового пользователя...")
            hashed_password = bcrypt.generate_password_hash('test').decode('utf-8')
            test = User(
                username='test',
                email='test@nettyhost.ru',
                password=hashed_password,
                is_admin=False
            )
            db.session.add(test)
            db.session.commit()
            print("✅ Пользователь test создан")
        
        # Выводим всех пользователей для проверки
        users = User.query.all()
        print(f"\nСписок пользователей в базе данных ({len(users)}):")
        for user in users:
            print(f"- {user.username} (ID: {user.id}, Email: {user.email}, Админ: {user.is_admin})")

def run_app_wsgi():
    """Запускает приложение через WSGI"""
    print("\nЗапуск приложения через WSGI...")
    
    # Формируем команду для запуска Flask-приложения
    command = [sys.executable, 'wsgi.py']
    
    # Запускаем приложение
    try:
        subprocess.run(command)
    except KeyboardInterrupt:
        print("\nПриложение остановлено пользователем")
    except Exception as e:
        print(f"\nОшибка при запуске приложения: {e}")

def main():
    print("=== Запуск приложения с исправлениями базы данных ===")
    
    # Инициализация базы данных
    init_database()
    
    # Запуск приложения
    run_app_wsgi()

if __name__ == "__main__":
    main() 