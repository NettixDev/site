#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Скрипт для проверки всех пользователей и их серверов
"""

from app import app, db, User, VDSServer
import sqlite3

def check_all_users_and_servers():
    with app.app_context():
        # Получаем всех пользователей
        users = User.query.all()
        print(f"=== Всего пользователей в базе: {len(users)} ===")
        
        for user in users:
            print(f"\nПользователь ID {user.id}:")
            print(f"  Имя: {user.username}")
            print(f"  Email: {user.email}")
            print(f"  Админ: {user.is_admin}")
            
            # Получаем серверы пользователя
            servers = user.vds_servers
            print(f"  Серверов: {len(servers)}")
            
            for server in servers:
                print(f"    ► Сервер ID: {server.id}")
                print(f"      План: {server.plan}")
                print(f"      Статус: {server.status}")
                print(f"      Ссылка: {server.access_link}")
        
        # Проверяем все серверы напрямую
        print("\n=== Все серверы в системе ===")
        all_servers = VDSServer.query.all()
        print(f"Всего серверов: {len(all_servers)}")
        
        for server in all_servers:
            user = User.query.get(server.user_id)
            print(f"\nСервер ID {server.id}:")
            print(f"  План: {server.plan}")
            print(f"  Статус: {server.status}")
            print(f"  Пользователь ID: {server.user_id}")
            print(f"  Имя пользователя: {user.username if user else 'НЕ НАЙДЕН!'}")
            print(f"  Ссылка доступа: {server.access_link}")

if __name__ == "__main__":
    check_all_users_and_servers() 