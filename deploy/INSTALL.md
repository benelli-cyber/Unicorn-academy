# Installing Unicorn Academy

Unicorn Academy runs on the **same Proxmox LXC as the Family Dashboard**, as a
separate app with its own folder, user, database and service, on port **8081**
(the dashboard keeps 8080). If one of them stops, the other keeps running.

Replace `192.168.1.50` with your LXC's address everywhere.

> **Keep it on your home network.** Never forward port 8081 on your router.

---

## 1. Install

Node.js 22 and git are already on the LXC from the dashboard install, so there
is nothing new to install. Open the container's console (or SSH in) and run
these as root.

### 1.1 Create a user and download the app

```bash
useradd --system --create-home --home-dir /var/lib/unicorn --shell /usr/sbin/nologin unicorn
```
```bash
git clone https://github.com/benelli-cyber/unicorn-academy.git /opt/unicorn-academy
```
```bash
chown -R unicorn:unicorn /opt/unicorn-academy
```

If the repo is **private**, `git clone` asks for a username and password. Use
your GitHub username and a **fine-grained personal access token** (GitHub →
Settings → Developer settings → Fine-grained tokens) with read-only *Contents*
access to just this repo, as the password.

### 1.2 Install the app's libraries

```bash
cd /opt/unicorn-academy && sudo -u unicorn npm ci --omit=dev
```

The SQLite module may compile, which takes a few minutes. If it stops with
`Killed`, raise the container's memory to 1024 MB for the install, as you did
for the dashboard.

### 1.3 Create the config file

```bash
sudo -u unicorn cp /opt/unicorn-academy/config.example.json /opt/unicorn-academy/config.json
```
```bash
chmod 600 /opt/unicorn-academy/config.json
```

`chmod 600` matters once you add an API key: only the app's user may read it.

**Homework photo reading (optional).** Homework Helper reads worksheet photos
with Claude, which needs an Anthropic API key. Without one, everything else
works and Homework Helper offers "pick the topic" instead.

1. Go to <https://console.anthropic.com>, sign in, and add a payment method
   (Settings → Billing). You pay per use; a worksheet photo typically costs
   a few cents. You can set a monthly spend limit there too.
2. API Keys → **Create Key**, name it `unicorn-academy`, and copy it.
3. `nano /opt/unicorn-academy/config.json` and paste it as `anthropicApiKey`:

   ```json
   {
     "port": 8081,
     "anthropicApiKey": "sk-ant-...",
     "model": "claude-opus-5-5"
   }
   ```

   Save with Ctrl+O, Enter, Ctrl+X.

The key is never sent to the browser or written to the log. The LXC needs
internet access to reach `api.anthropic.com`, only for reading photos.

Do a quick test run (stop it with Ctrl+C):

```bash
cd /opt/unicorn-academy && sudo -u unicorn node server/index.js
```

It prints `Unicorn Academy on http://localhost:8081/ (homework photos on, ...)`.
Open `http://192.168.1.50:8081/` from a computer on your network.

### 1.4 Run it as a service

```bash
cp /opt/unicorn-academy/deploy/unicorn-academy.service /etc/systemd/system/
```
```bash
systemctl daemon-reload && systemctl enable --now unicorn-academy
```
```bash
systemctl status unicorn-academy
```

`status` should say **active (running)**.

| What | Command |
| ---- | ------- |
| Live log | `journalctl -u unicorn-academy -f` |
| Restart (after editing config.json) | `systemctl restart unicorn-academy` |
| Stop | `systemctl stop unicorn-academy` |

### 1.5 Firewall (only if you set one up for the dashboard)

```bash
ufw allow from 192.168.1.0/24 to any port 8081 proto tcp
```

---

## 2. On her iPad

1. Open **Safari** and go to `http://192.168.1.50:8081/`.
2. Tap **Share → Add to Home Screen → Add**. It now opens full screen like an app.

If you gave the LXC a name in your router or Pi-hole (for example
`unicorn.lan`), use `http://unicorn.lan:8081/` instead.

---

## 3. Bring her progress over from the claude.ai version

Her coins, unicorn, skills and rosettes come with her in two steps:

1. In the **claude.ai** version: Grown-ups → enter PIN → **Copy progress**.
   (If nothing is copied, a box of text appears: select all of it and copy.)
2. In the **home-server** version, after creating any rider: Grown-ups →
   **Paste progress** → paste → **Import**.

The PIN comes over too. Do this on the same device, or send the copied text to
yourself (email or notes) to paste on another device.

---

## 4. More than one child

Grown-ups → **Add another rider**. When there are two or more riders, the app
asks "Who's riding today?" on a new device, and the home screen shows a
**Switch rider** link. Each rider has their own progress, coins and PIN.

---

## 5. Updating

When there's a new version on GitHub:

```bash
cd /opt/unicorn-academy && sudo -u unicorn git pull && sudo -u unicorn npm ci --omit=dev && systemctl restart unicorn-academy
```

Open pages pick up the new version the next time they're reloaded.

---

## 6. Backups

Progress lives in `/opt/unicorn-academy/data/unicorn-academy.db`. Your normal
Proxmox backups of the LXC cover it. For a quick extra copy of one rider, use
Grown-ups → **Copy progress** and keep the text somewhere safe.

Each device also keeps its own copy of the last progress it saw, so if the
server is briefly down she can keep playing; her progress is sent to the
server when it's back.
