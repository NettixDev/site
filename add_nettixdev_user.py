#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Скрипт для добавления пользователя NettixDev
"""

from app import app, db, User, bcrypt, VDSServer

def add_nettixdev_user():
    with app.app_context():
        # Проверяем существование пользователя
        user = User.query.filter_by(username='NettixDev').first()
        
        if user:
            print(f"Пользователь 'NettixDev' уже существует (ID: {user.id})")
            print(f"Email: {user.email}")
            print(f"Админ: {user.is_admin}")
        else:
            # Создаем нового пользователя
            hashed_password = bcrypt.generate_password_hash('nettix').decode('utf-8')
            user = User(
                username='NettixDev',
                email='nettixdev@nettyhost.ru',
                password=hashed_password,
                is_admin=False  # Устанавливаем обычного пользователя
            )
            
            # Сохраняем пользователя
            db.session.add(user)
            db.session.flush()  # Получаем ID, не коммитя транзакцию
            
            print(f"Создан пользователь:")
            print(f"ID: {user.id}")
            print(f"Логин: NettixDev")
            print(f"Пароль: nettix")
            print(f"Email: nettixdev@nettyhost.ru")
            print(f"Админ: {user.is_admin}")
            
            # Переносим серверы от пользователя admin к NettixDev
            admin = User.query.filter_by(username='admin').first()
            
            if admin:
                # Получаем серверы admin
                admin_servers = VDSServer.query.filter_by(user_id=admin.id).all()
                
                print(f"\nПеренос серверов от admin к NettixDev:")
                print(f"Всего серверов для переноса: {len(admin_servers)}")
                
                # Переносим серверы
                transferred_count = 0
                for server in admin_servers:
                    print(f"Перенос сервера ID {server.id} ({server.plan})")
                    server.user_id = user.id
                    transferred_count += 1
                
                print(f"\nПеренесено серверов: {transferred_count}")
            
            # Сохраняем все изменения
            db.session.commit()
            print("\nВсе изменения сохранены в базе данных")

if __name__ == "__main__":
    add_nettixdev_user() 