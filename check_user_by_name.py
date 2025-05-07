#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Скрипт для проверки конкретного пользователя по имени
"""

from app import app, db, User
import sys

def check_user(username):
    with app.app_context():
        # Ищем пользователя по имени
        user = User.query.filter_by(username=username).first()
        
        if user:
            print(f"✅ Пользователь '{username}' найден:")
            print(f"  ID: {user.id}")
            print(f"  Имя: {user.username}")
            print(f"  Email: {user.email}")
            print(f"  Админ: {user.is_admin}")
            
            # Проверяем серверы пользователя
            servers = user.vds_servers
            print(f"\nСерверов у пользователя: {len(servers)}")
            
            for server in servers:
                print(f"  Сервер ID: {server.id}")
                print(f"  План: {server.plan}")
                print(f"  Статус: {server.status}")
                print(f"  Создан: {server.created_at}")
                print(f"  Ссылка: {server.access_link}")
                print("")
        else:
            print(f"❌ Пользователь '{username}' не найден")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        username = sys.argv[1]
    else:
        username = input("Введите имя пользователя для проверки: ")
    
    check_user(username) 