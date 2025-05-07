#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Скрипт для отладки проблем с авторизацией
"""

from app import app, db, User, bcrypt

def debug_login(username, password):
    with app.app_context():
        print(f"Попытка входа для пользователя: {username}")
        
        # Ищем пользователя в базе данных
        user = User.query.filter_by(username=username).first()
        
        if not user:
            print(f"❌ Пользователь {username} не найден в базе данных")
            return
        
        print(f"✅ Пользователь найден:")
        print(f"  ID: {user.id}")
        print(f"  Имя: {user.username}")
        print(f"  Email: {user.email}")
        print(f"  Админ: {user.is_admin}")
        
        # Проверяем пароль
        if bcrypt.check_password_hash(user.password, password):
            print(f"✅ Пароль верный")
        else:
            print(f"❌ Неверный пароль")

if __name__ == "__main__":
    # Проверяем вход для admin
    debug_login("admin", "admin")
    print("\n" + "-"*50 + "\n")
    
    # Проверяем вход для test
    debug_login("test", "test") 