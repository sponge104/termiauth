
---

# termiauth

terminal-based authenticator

i got tired of those clunky authenticator apps, so i made my own in javascript (because why the heck not).

just clone this repo and get started:

```bash
git clone https://github.com/sponge104/termiauth.git  
cd termiauth
```

install dependencies:

```bash
npm install
```

run the app:

```bash
node termiauth.mjs
```

if you want me to make a gui version, just shout. if enough people ask, i’ll do it.

---

you can import exports from oneauth (haven’t tested others much yet). ping me on github if you want me to support more.

no stupid tracking — just a minimal terminal authenticator app :)

---

## version history

* **v1.0** — the base app with passphrase protection
* **v1.1** — added security question recovery for forgotten passphrases
* **v1.2** — added hashed and salted storage so even if someone gets on your machine, your secrets stay safer \:d

---

*feel free to open issues or pull requests on github if you want to chat or request features!*
