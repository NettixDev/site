#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Скрипт для проверки всех пользователей в базе данных
"""

from app import app, db, User
import sqlite3

def check_db_admin_column():
    """Проверяет наличие колонки is_admin непосредственно через SQL"""
    try:
        # Подключаемся напрямую к БД
        conn = sqlite3.connect('instance/nettyhost.db')
        cursor = conn.cursor()
        
        # Получаем информацию о структуре таблицы
        cursor.execute("PRAGMA table_info(user)")
        columns = cursor.fetchall()
        
        print("=== Структура таблицы user (из SQLite) ===")
        for col in columns:
            print(f"Колонка: {col[1]}, Тип: {col[2]}, NotNull: {col[3]}, DefaultValue: {col[4]}")
        
        # Проверяем, есть ли колонка is_admin
        is_admin_exists = any(col[1] == 'is_admin' for col in columns)
        print(f"\nКолонка is_admin существует: {is_admin_exists}")
        
        # Получаем всех пользователей напрямую через SQL
        cursor.execute("SELECT id, username, email, is_admin FROM user")
        users = cursor.fetchall()
        
        print("\n=== Пользователи в базе (из SQLite) ===")
        for user in users:
            print(f"ID: {user[0]}, Имя: {user[1]}, Email: {user[2]}, Админ: {user[3]}")
        
        conn.close()
    except Exception as e:
        print(f"Ошибка при прямом доступе к базе: {e}")

def check_users_orm():
    """Проверяет пользователей через ORM"""
    with app.app_context():
        users = User.query.all()
        
        print("\n=== Пользователи в базе (через ORM) ===")
        for user in users:
            print(f"ID: {user.id}, Имя: {user.username}, Email: {user.email}, Админ: {user.is_admin}")

if __name__ == "__main__":
    check_db_admin_column()
    check_users_orm() 