#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Скрипт для очистки всех сессий
"""

import os
import shutil
from app import app

def clear_sessions():
    # Путь к директории сессий
    session_dir = 'flask_session'
    
    # Проверяем, существует ли директория
    if os.path.exists(session_dir):
        # Удаляем все файлы в директории
        files = os.listdir(session_dir)
        print(f"Найдено {len(files)} файлов сессий")
        
        for file in files:
            file_path = os.path.join(session_dir, file)
            try:
                if os.path.isfile(file_path):
                    os.unlink(file_path)
                    print(f"Удален файл: {file_path}")
            except Exception as e:
                print(f"Ошибка при удалении {file_path}: {e}")
        
        print("Все сессии успешно очищены")
    else:
        print(f"Директория {session_dir} не найдена")

if __name__ == "__main__":
    clear_sessions() 