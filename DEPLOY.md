# 🚀 Деплой Bot Factory на VPS

## Требования к серверу
- Ubuntu 22.04 LTS
- 2+ vCPU, 4+ GB RAM, 40 GB SSD
- Доменное имя направленное на IP сервера (A-запись)

---

## 1. Подготовка сервера

```bash
# Обновляем систему
sudo apt update && sudo apt upgrade -y

# Устанавливаем Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Устанавливаем docker-compose
sudo apt install docker-compose-plugin -y

# Устанавливаем git
sudo apt install git -y
```

---

## 2. Клонируем репозиторий

```bash
git clone https://github.com/karlosdzunior-hub/Botify.git botfactory
cd botfactory
```

---

## 3. Настраиваем переменные окружения

```bash
cp .env.example .env
nano .env
```

Заполни все поля (особенно важные):
- `MAIN_BOT_TOKEN` — токен от @BotFather
- `MINI_APP_URL` — твой HTTPS домен (например `https://botfactory.ru`)
- `POSTGRES_PASSWORD` — придумай надёжный пароль
- `SESSION_SECRET` — `openssl rand -hex 32`
- `FERNET_KEY` — `openssl rand -base64 32`
- `GROQ_API_KEY` — с console.groq.com (бесплатно)
- `GEMINI_API_KEY` — с aistudio.google.com (бесплатно)
- `DOMAIN` — твой домен без https://

---

## 4. Настройка Nginx конфига

```bash
# Подставь свой домен в nginx.conf
sed -i 's/${DOMAIN}/yourdomain.com/g' nginx/nginx.conf
```

---

## 5. Получаем SSL сертификат (Let's Encrypt)

```bash
# Сначала поднимаем только nginx на HTTP (для верификации домена)
docker compose up -d web

# Получаем сертификат
docker compose run --rm certbot certonly \
  --webroot \
  -w /var/www/certbot \
  -d yourdomain.com \
  --email your@email.com \
  --agree-tos \
  --non-interactive

# Перезапускаем nginx с SSL
docker compose restart web
```

---

## 6. Запускаем всё

```bash
docker compose up -d
```

Проверяем что всё работает:
```bash
docker compose ps
docker compose logs api --tail=50
```

---

## 7. Применяем миграции БД

```bash
docker compose exec api npx drizzle-kit push
```

---

## 8. Настраиваем бота в @BotFather

1. Открой @BotFather в Telegram
2. Выбери своего бота → Edit Bot → Edit Menu Button
3. Вставь URL: `https://yourdomain.com`
4. Название кнопки: `🤖 Открыть Bot Factory`

---

## Готово! ✅

Открой Telegram → найди своего бота → нажми `/start`

---

## Обновление приложения

```bash
git pull
docker compose build
docker compose up -d
```

## Просмотр логов

```bash
# Все логи
docker compose logs -f

# Только API
docker compose logs -f api

# Только БД
docker compose logs -f postgres
```

## Резервная копия БД

```bash
docker compose exec postgres pg_dump -U botfactory botfactory > backup_$(date +%Y%m%d).sql
```

---

## Стоимость сервера

| Хостинг | Конфигурация | Цена/мес |
|---|---|---|
| Selectel | 2 vCPU / 4 GB | ~900 ₽ |
| Timeweb | 2 vCPU / 4 GB | ~800 ₽ |
| Reg.ru | 2 vCPU / 4 GB | ~750 ₽ |
| Hetzner | 2 vCPU / 4 GB | ~700 ₽ |
