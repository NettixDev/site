import requests
import webbrowser

# Эти данные вы получите после регистрации приложения
client_id = "F1A1CF2F16256178521A05CA633F03C9A5F757244B95DB3E248ED0A64DBE6676" 
redirect_uri = "https://localhost/callback"

# Формируем URL авторизации (исправлен формат)
auth_url = f"https://yoomoney.ru/oauth/authorize?client_id={client_id}&response_type=code&redirect_uri={redirect_uri}&scope=account-info operation-history operation-details payment.to-account.4100119127110327"

print(f"Открываю URL для авторизации: {auth_url}")

# Открываем браузер - вам нужно будет войти в аккаунт YooMoney и разрешить доступ
webbrowser.open(auth_url)

# После авторизации вы будете перенаправлены на redirect_uri с кодом в параметрах URL
# Например: https://localhost/callback?code=ABCDEFG...

# Скопируйте код из URL и вставьте его сюда:
code = input("Введите полученный код: ")

# Теперь обменяем код на токен
token_url = "https://yoomoney.ru/oauth/token"
data = {
    "code": code,
    "client_id": client_id,
    "grant_type": "authorization_code",
    "redirect_uri": redirect_uri
}

response = requests.post(token_url, data=data)
token_data = response.json()

# Выведем полученный токен и полный ответ для отладки
print("\nПолный ответ сервера:", token_data)
print("\nВаш токен доступа:", token_data.get("access_token"))