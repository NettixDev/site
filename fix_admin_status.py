#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Скрипт для исправления статуса администратора в базе данных
"""

from app import app, db, User
import sys

def fix_admin_status():
    with app.app_context():
        # Проверяем структуру таблицы User
        print("=== Структура таблицы User ===")
        columns = [column.name for column in User.__table__.columns]
        print(f"Колонки в таблице: {columns}")
        
        # Получаем всех пользователей
        users = User.query.all()
        print(f"\n=== Всего пользователей в базе: {len(users)} ===")
        
        # Выводим текущие статусы
        for user in users:
            try:
                print(f"ID: {user.id}, Имя: {user.username}, Email: {user.email}, Админ: {user.is_admin}")
            except Exception as e:
                print(f"Ошибка при доступе к атрибутам пользователя {user.username}: {e}")
        
        # Проверяем, есть ли колонка is_admin
        if 'is_admin' not in columns:
            print("\n❌ ОШИБКА: Колонка is_admin отсутствует в таблице User!")
            print("Для исправления запустите: python add_admin_column.py")
            return
        
        # Устанавливаем статус админа только для пользователя 'admin'
        print("\n=== Обновление статусов ===")
        admin_count = 0
        for user in users:
            if user.username == 'admin':
                if not user.is_admin:
                    print(f"👑 Пользователь '{user.username}' получает права администратора")
                    user.is_admin = True
                    admin_count += 1
                else:
                    print(f"✓ Пользователь '{user.username}' уже является администратором")
            else:
                if user.is_admin:
                    print(f"⚠️ Пользователь '{user.username}' теряет права администратора")
                    user.is_admin = False
                    admin_count += 1
                else:
                    print(f"✓ Пользователь '{user.username}' уже является обычным пользователем")
        
        # Сохраняем изменения, если были обновления
        if admin_count > 0:
            db.session.commit()
            print(f"\n✅ Обновлено пользователей: {admin_count}")
        else:
            print("\n✅ Изменения не требуются, все права настроены корректно")

# Создаем скрипт для добавления колонки is_admin, если ее не существует
def create_admin_column_script():
    with open('add_admin_column.py', 'w') as f:
        f.write("""#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from app import app, db

with app.app_context():
    db.engine.execute('ALTER TABLE user ADD COLUMN is_admin BOOLEAN DEFAULT 0')
    print("Колонка is_admin успешно добавлена в таблицу user")
""")
    print("\nСоздан файл add_admin_column.py для добавления колонки is_admin")

if __name__ == "__main__":
    fix_admin_status()
    create_admin_column_script() 