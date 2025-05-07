#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Скрипт для исправления проблем с авторизацией
"""

from app import app, db, User, bcrypt
import json
import requests

def test_login_api(username, password):
    """Тестирует вход через API"""
    print(f"\n=== Тестирование входа через API ===")
    print(f"Пользователь: {username}")
    
    try:
        # Формируем данные для запроса
        data = {
            'username': username,
            'password': password
        }
        
        # Выполняем POST-запрос на API авторизации
        response = requests.post(
            'http://localhost:5000/api/login',
            json=data,
            headers={'Content-Type': 'application/json'}
        )
        
        print(f"Код ответа: {response.status_code}")
        
        try:
            result = response.json()
            print(f"Ответ API: {json.dumps(result, indent=2, ensure_ascii=False)}")
            
            if result.get('success'):
                print("✅ API вернул успешный ответ - вход выполнен")
                return True
            else:
                print(f"❌ API вернул ошибку: {result.get('message')}")
                return False
                
        except Exception as e:
            print(f"❌ Ошибка при разборе JSON: {e}")
            print(f"Текст ответа: {response.text}")
            return False
                
    except Exception as e:
        print(f"❌ Ошибка при выполнении запроса: {e}")
        return False

def check_and_reset_password(username, new_password):
    """Проверяет и сбрасывает пароль пользователя"""
    with app.app_context():
        print(f"\n=== Проверка и сброс пароля ===")
        
        # Ищем пользователя
        user = User.query.filter_by(username=username).first()
        
        if not user:
            print(f"❌ Пользователь {username} не найден в базе данных!")
            return False
        
        print(f"✅ Пользователь найден в базе:")
        print(f"  ID: {user.id}")
        print(f"  Email: {user.email}")
        print(f"  Админ: {user.is_admin}")
        
        # Сбрасываем пароль
        try:
            hashed_password = bcrypt.generate_password_hash(new_password).decode('utf-8')
            user.password = hashed_password
            db.session.commit()
            
            print(f"✅ Пароль для пользователя {username} успешно сброшен!")
            return True
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Ошибка при сбросе пароля: {e}")
            return False

def recreate_user(username, email, password, is_admin=False):
    """Удаляет и создает пользователя заново"""
    with app.app_context():
        print(f"\n=== Пересоздание пользователя ===")
        
        # Удаляем пользователя если он существует
        user = User.query.filter_by(username=username).first()
        if user:
            try:
                db.session.delete(user)
                db.session.commit()
                print(f"✅ Пользователь {username} удален")
            except Exception as e:
                db.session.rollback()
                print(f"❌ Ошибка при удалении пользователя: {e}")
                return False
        
        # Создаем пользователя заново
        try:
            hashed_password = bcrypt.generate_password_hash(password).decode('utf-8')
            new_user = User(
                username=username,
                email=email,
                password=hashed_password,
                is_admin=is_admin
            )
            
            db.session.add(new_user)
            db.session.commit()
            
            print(f"✅ Пользователь {username} успешно создан заново!")
            print(f"  ID: {new_user.id}")
            print(f"  Email: {new_user.email}")
            print(f"  Админ: {new_user.is_admin}")
            
            return True
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Ошибка при создании пользователя: {e}")
            return False

if __name__ == "__main__":
    # Проверяем текущий вход
    login_result = test_login_api("NettixDev", "nettix")
    
    if not login_result:
        # Сбрасываем пароль
        print("\nВход не удался. Пробуем сбросить пароль...")
        reset_result = check_and_reset_password("NettixDev", "nettix")
        
        if not reset_result:
            # Если сброс не удался, пробуем пересоздать пользователя
            print("\nСброс пароля не удался. Пересоздаем пользователя...")
            recreate_result = recreate_user("NettixDev", "nettixdev@nettyhost.ru", "nettix", False)
            
            if recreate_result:
                print("\nПользователь пересоздан. Проверяем вход снова...")
                test_login_api("NettixDev", "nettix")
            else:
                print("\n❌ Не удалось исправить проблему с пользователем!")
        else:
            # Проверяем вход снова после сброса пароля
            print("\nПароль сброшен. Проверяем вход снова...")
            test_login_api("NettixDev", "nettix")
    else:
        print("\n✅ Вход работает корректно, дополнительные действия не требуются!") 