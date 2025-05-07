#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Скрипт для добавления тестового пользователя
"""

from app import app, db, User, bcrypt

def add_test_user():
    with app.app_context():
        # Проверяем существование тестового пользователя
        test_user = User.query.filter_by(username='test').first()
        
        if test_user:
            print(f"Пользователь 'test' уже существует (ID: {test_user.id})")
            print(f"Email: {test_user.email}")
            print(f"Админ: {test_user.is_admin}")
        else:
            # Создаем тестового пользователя
            hashed_password = bcrypt.generate_password_hash('test').decode('utf-8')
            test_user = User(
                username='test',
                email='test@nettyhost.ru',
                password=hashed_password,
                is_admin=False  # Явно устанавливаем статус не-админа
            )
            
            # Сохраняем пользователя
            db.session.add(test_user)
            db.session.commit()
            
            print(f"Создан тестовый пользователь:")
            print(f"Логин: test")
            print(f"Пароль: test")
            print(f"Email: test@nettyhost.ru")
            print(f"ID: {test_user.id}")
            print(f"Админ: {test_user.is_admin}")

if __name__ == "__main__":
    add_test_user() 