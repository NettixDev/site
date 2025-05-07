# NettyHost - Python Version

Версия хостинг-сервиса на Flask с интеграцией ЮMoney для приёма платежей.

## Установка

1. Убедитесь, что у вас установлен Python 3.10 или выше.

2. Клонируйте репозиторий:
```bash
git clone https://github.com/yourusername/nettyhost.git
cd nettyhost
```

3. Создайте и активируйте виртуальное окружение:
```bash
# Linux/Mac
python -m venv venv
source venv/bin/activate

# Windows
python -m venv venv
venv\Scripts\activate
```

4. Установите зависимости:
```bash
pip install -r requirements.txt
```

5. Создайте файл `.env` в корне проекта и укажите необходимые переменные окружения:
```
FLASK_APP=app.py
FLASK_ENV=development
SECRET_KEY=your-secret-key
YOOMONEY_WALLET=4100123456789
YOOMONEY_TOKEN=your-yoomoney-token
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

## Запуск

Для запуска сервера в режиме разработки:
```bash
flask run --host=0.0.0.0 --port=3000
```

или

```bash
python app.py
```

Для запуска в production-режиме рекомендуется использовать gunicorn:
```bash
gunicorn -w 4 -b 0.0.0.0:3000 app:app
```

## Функциональность

1. **Авторизация и регистрация пользователей**
   - Регистрация нового аккаунта
   - Вход в существующий аккаунт
   - Восстановление пароля

2. **Личный кабинет**
   - Управление VDS серверами
   - История платежей
   - Настройки профиля

3. **Заказ и оплата VDS**
   - Выбор плана VDS (Basic, Standard, Premium)
   - Оплата через ЮMoney
   - Проверка статуса оплаты
   - Автоматическая активация сервера после оплаты

4. **Телеграм-бот для администраторов**
   - Уведомления о новых заказах
   - Управление заказами
   - Проверка статуса серверов

## API Документация

### Авторизация

- **POST /api/register** - Регистрация нового пользователя
- **POST /api/login** - Авторизация пользователя
- **POST /api/logout** - Выход из аккаунта

### VDS Серверы

- **POST /api/vds/order** - Создание заказа на VDS
- **GET /api/vds/list** - Получение списка VDS серверов пользователя

### Платежи

- **POST /api/yoomoney/webhook** - Вебхук для уведомлений от ЮMoney об успешной оплате

## Интеграция с ЮMoney

В проекте используется официальная библиотека `yoomoney` для Python. 

Для полной функциональности необходимо:

1. Создать кошелек ЮMoney: https://yoomoney.ru/
2. Получить токен API в разделе "Управление API" (для проверки платежей)
3. Указать полученный токен в переменных окружения

## Разработка и поддержка

Для вопросов и предложений: admin@nettyhost.ru 