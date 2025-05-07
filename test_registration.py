#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Скрипт для тестирования процесса регистрации
"""

from app import app, db, User, bcrypt
import sys
import uuid
import json
import requests

def test_db_registration(username, email, password):
    """Тестирует прямую регистрацию в базе данных"""
    with app.app_context():
        print(f"\n=== Тест прямой регистрации в БД ===")
        print(f"Проверка пользователя: {username}")
        
        # Проверяем существование пользователя
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            print(f"❌ Пользователь {username} уже существует в БД!")
            return False
        
        # Создаем пользователя напрямую
        try:
            hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
            user = User(username=username, email=email, password=hashed_password, is_admin=False)
            
            db.session.add(user)
            db.session.commit()
            
            print(f"✅ Пользователь {username} успешно добавлен в БД!")
            
            # Проверяем, что пользователь действительно добавлен
            new_user = User.query.filter_by(username=username).first()
            if new_user:
                print(f"✅ Подтверждено: пользователь найден в БД после добавления")
                print(f"  ID: {new_user.id}")
                print(f"  Email: {new_user.email}")
                print(f"  Админ: {new_user.is_admin}")
                return True
            else:
                print(f"❌ Ошибка: пользователь НЕ НАЙДЕН в БД после добавления!")
                return False
                
        except Exception as e:
            db.session.rollback()
            print(f"❌ Ошибка при добавлении пользователя: {e}")
            return False

def test_api_registration(username, email, password):
    """Тестирует регистрацию через API"""
    print(f"\n=== Тест регистрации через API ===")
    
    try:
        # Формируем данные для запроса
        data = {
            'username': username,
            'email': email,
            'password': password
        }
        
        # Выполняем POST-запрос на API регистрации
        response = requests.post(
            'http://localhost:5000/api/register',
            json=data,
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"Код ответа: {response.status_code}")
        
        try:
            result = response.json()
            print(f"Ответ API: {json.dumps(result, indent=2, ensure_ascii=False)}")
            
            if result.get('success'):
                print("✅ API вернул успешный ответ")
            else:
                print(f"❌ API вернул ошибку: {result.get('message')}")
                
        except Exception as e:
            print(f"❌ Ошибка при разборе JSON: {e}")
            print(f"Текст ответа: {response.text}")
            
        # Проверяем, что пользователь действительно добавлен в БД
        with app.app_context():
            user = User.query.filter_by(username=username).first()
            if user:
                print(f"✅ Подтверждено: пользователь найден в БД после регистрации через API")
                print(f"  ID: {user.id}")
                print(f"  Email: {user.email}")
                print(f"  Админ: {user.is_admin}")
                return True
            else:
                print(f"❌ Ошибка: пользователь НЕ НАЙДЕН в БД после регистрации через API!")
                return False
                
    except Exception as e:
        print(f"❌ Ошибка при выполнении запроса: {e}")
        return False

def main():
    # Генерируем уникальные имена для тестов
    unique_id = str(uuid.uuid4())[:8]
    test_username = f"test_{unique_id}"
    test_email = f"test_{unique_id}@example.com"
    test_password = "password123"
    
    print(f"Тестовые данные:")
    print(f"- Имя: {test_username}")
    print(f"- Email: {test_email}")
    print(f"- Пароль: {test_password}")
    
    # Тестируем прямую регистрацию
    db_result = test_db_registration(test_username, test_email, test_password)
    
    # Генерируем новое уникальное имя для API-теста
    unique_id = str(uuid.uuid4())[:8]
    api_username = f"api_{unique_id}"
    api_email = f"api_{unique_id}@example.com"
    
    print(f"\nТестовые данные для API:")
    print(f"- Имя: {api_username}")
    print(f"- Email: {api_email}")
    print(f"- Пароль: {test_password}")
    
    # Тестируем регистрацию через API
    api_result = test_api_registration(api_username, api_email, test_password)
    
    # Выводим итоговый результат
    print("\n=== Результаты тестирования ===")
    print(f"Прямая регистрация в БД: {'✅ Успешно' if db_result else '❌ Не удалось'}")
    print(f"Регистрация через API: {'✅ Успешно' if api_result else '❌ Не удалось'}")
    
    if not db_result and not api_result:
        print("\n⚠️ Серьезная проблема с регистрацией! Проверьте настройки базы данных.")
    elif not api_result and db_result:
        print("\n⚠️ Проблема с API регистрации! API не работает корректно.")
    elif api_result and db_result:
        print("\n✅ Оба метода регистрации работают корректно!")

if __name__ == "__main__":
    main() 