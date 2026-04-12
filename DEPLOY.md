# Інструкція: Розгортання Cthulhu Keeper на VPS через Claude Code

## Що нам потрібно

- VPS з Ubuntu 24.04 (Hetzner CX32)
- Docker + Docker Compose вже встановлено
- PostgreSQL вже запущено в Docker
- Claude Code встановлено (`npm install -g @anthropic-ai/claude-code`)
- Anthropic API key

---

## КРОК 1 — Підготовка сервера

### 1.1 Підключись до сервера
```bash
ssh anton@<SERVER_IP>
```

### 1.2 Створи папку для проекту
```bash
sudo mkdir -p /opt/apps/cthulhu
sudo chown anton:anton /opt/apps/cthulhu
cd /opt/apps/cthulhu
```

### 1.3 Встанови Node.js 20 (якщо немає)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # має бути v20.x
```

### 1.4 Встанови Claude Code
```bash
npm install -g @anthropic-ai/claude-code
claude --version
```

---

## КРОК 2 — Підготовка БД

### 2.1 Підключись до PostgreSQL і створи БД
```bash
docker exec -it postgres psql -U anton -c "CREATE DATABASE cthulhu;"
docker exec -it postgres psql -U anton -c "GRANT ALL PRIVILEGES ON DATABASE cthulhu TO anton;"
```

### 2.2 Перевір підключення
```bash
docker exec -it postgres psql -U anton -d cthulhu -c "\l"
# Має показати cthulhu в списку
```

---

## КРОК 3 — Завантаж CLAUDE.md на сервер

### 3.1 Скопіюй файл CLAUDE.md в папку проекту
```bash
# Варіант A — через scp з локальної машини:
scp CLAUDE.md anton@<SERVER_IP>:/opt/apps/cthulhu/

# Варіант B — створи вручну:
nano /opt/apps/cthulhu/CLAUDE.md
# (вставити вміст файлу CLAUDE.md)
```

---

## КРОК 4 — Запуск Claude Code

### 4.1 Перейди в папку і запусти
```bash
cd /opt/apps/cthulhu
export ANTHROPIC_API_KEY=sk-ant-...   # твій ключ
claude
```

### 4.2 Перший промпт для Claude Code

Скопіюй і відправ цей промпт:

```
Прочитай файл CLAUDE.md в поточній директорії — це повна специфікація 
проекту який ти маєш побудувати.

Після читання:
1. Створи Next.js 15 проект в поточній директорії
2. Встанови всі залежності
3. Побудуй проект згідно специфікації — повністю, без пропусків
4. Починай з типів і бази даних, потім API routes, потім компоненти
5. Після завершення — запусти npm run build щоб перевірити що все компілюється

DATABASE_URL=postgres://anton:PASSWORD@localhost:5432/cthulhu
(замінити PASSWORD на реальний пароль з .env файлу)

Будуй повністю автономно, не питай дозволу на кожен крок.
```

### 4.3 Що буде відбуватись

Claude Code буде:
- Читати CLAUDE.md
- Створювати файли один за одним
- Встановлювати залежності
- Писати код згідно специфікації
- Запускати перевірки

Це займе **15-25 хвилин**. Не переривай.

---

## КРОК 5 — Перевірка після збірки

### 5.1 Перевір що всі файли створено
```bash
ls -la /opt/apps/cthulhu/src/
ls -la /opt/apps/cthulhu/scenarios/
ls -la /opt/apps/cthulhu/src/app/api/
```

### 5.2 Перевір що проект білдиться
```bash
cd /opt/apps/cthulhu
npm run build
# Має завершитись без помилок
```

### 5.3 Тест локально
```bash
# Створи .env.local для тесту:
cat > .env.local << EOF
DATABASE_URL=postgres://anton:PASSWORD@localhost:5432/cthulhu
ANTHROPIC_API_KEY=sk-ant-...
EOF

npm run dev
# Відкрий в браузері: http://<SERVER_IP>:3000
```

---

## КРОК 6 — Якщо щось не так

### 6.1 Попроси Claude Code виправити
```bash
# Якщо є помилки компіляції — просто скажи Claude Code:
claude

# Промпт:
"npm run build показує такі помилки: [вставити помилки]
Виправ їх."
```

### 6.2 Якщо не вистачає логіки
```bash
# Промпт для Claude Code:
"Перевір що API route /api/ai правильно:
1. Будує system prompt через buildSystemPrompt()
2. Використовує prompt caching
3. Зберігає повідомлення в БД
4. Запускає summarize кожні 20 повідомлень
Якщо щось пропущено — додай."
```

### 6.3 Якщо потрібно додати сценарій
```bash
# Промпт для Claude Code:
"Створи scenarios/the-haunting.json з повним сценарієм 
The Haunting для Call of Cthulhu.
Включи: systemPrompt, railguards, mustHappenEvents, 
всіх NPC з секретами, всі локації з підказками."
```

---

## КРОК 7 — Docker і деплой

### 7.1 Побудуй Docker образ
```bash
cd /opt/apps/cthulhu
docker build -t cthulhu:latest .
```

### 7.2 Додай сервіс в docker-compose.yml
```bash
nano /opt/apps/docker-compose.yml
```

Додай в секцію `services`:
```yaml
  cthulhu:
    image: cthulhu:latest
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    environment:
      DATABASE_URL: postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/cthulhu
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
    networks:
      - web
      - internal
```

### 7.3 Додай в .env файл
```bash
nano /opt/apps/.env
# Додай рядок:
ANTHROPIC_API_KEY=sk-ant-...
```

### 7.4 Додай в Caddyfile
```bash
nano /opt/apps/Caddyfile
# Додай:
cthulhu.antonpd.com {
    reverse_proxy cthulhu:3000
}
```

### 7.5 Запусти
```bash
cd /opt/apps
docker compose up -d cthulhu
docker compose restart caddy
docker compose logs -f cthulhu
```

---

## КРОК 8 — Перевірка на телефоні

1. Відкрий `https://cthulhu.antonpd.com` в браузері
2. Створи нову сесію
3. Додай гравця
4. Напиши перше повідомлення
5. Перевір що Keeper відповідає
6. Перевір озвучення (кнопка ↻)
7. Перевір мікрофон (кнопка 🎤) — тільки Chrome/Android

---

## КРОК 9 — Оновлення після змін

Якщо потрібно оновити код:

```bash
cd /opt/apps/cthulhu

# Якщо редагував через Claude Code — просто rebuild:
docker build -t cthulhu:latest .
docker compose up -d cthulhu

# Або швидше — через docker compose:
docker compose up -d --build cthulhu
```

---

## Корисні команди для дебагу

```bash
# Логи додатку:
docker compose logs -f cthulhu

# Перевірка БД:
docker exec -it postgres psql -U anton -d cthulhu
\dt                          # список таблиць
SELECT * FROM game_sessions; # сесії
SELECT count(*) FROM messages; # кількість повідомлень

# Перезапуск:
docker compose restart cthulhu

# Rebuild з нуля:
docker compose down cthulhu
docker build -t cthulhu:latest . --no-cache
docker compose up -d cthulhu
```

---

## Типові проблеми

| Проблема | Рішення |
|---|---|
| `Cannot connect to database` | Перевір DATABASE_URL, чи запущено postgres |
| `Invalid API key` | Перевір ANTHROPIC_API_KEY в .env |
| `Build failed` | Запусти `claude` і попроси виправити помилки |
| `Voice не працює на iOS` | Нормально — Web Speech API обмежено на Safari |
| `Caddy не дає SSL` | Перевір DNS записи в Cloudflare |
| `Port 3000 already in use` | `docker compose down cthulhu && docker compose up -d cthulhu` |
