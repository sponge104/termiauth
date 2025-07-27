
---

# termiauth

terminal-based authenticator

i got tired of those clunky authenticator apps, so i made my own in javascript (because why the heck not).

just clone this repo and get started:

```bash
git clone https://github.com/sponge104/termiauth.git
cd termiauth
npm install -g .
```
install dependencies:

```bash
npm install
```

run the app:

```bash
node termiauth.mjs
```

to import your codes from a txt  json(not fully supported) please move your file to the termiauth/ directory .txt formats are 
```bash
otpauth://totp/GitHub:Example?algorithm=SHA1&digits=6&issuer=GitHub&period=30&secret=SecretHere&icon=SVG%2FGithub.svg
```
---

you can import exports from oneauth (haven’t tested others much yet). ping me on github if you want me to support more.



i kinda forgot this you can make this globally by using this setup

after installing go to package.json it should look something like this



![image](https://github.com/user-attachments/assets/35db9f42-0fcf-4e19-aedc-79dfa4d33293)

add a bin field after main like this

```json

  "bin":{
    "termiauth": "./termiauth.mjs"
  },
```
now it should look like this

![image](https://github.com/user-attachments/assets/baac1881-6e00-4ab9-9788-e22995d9adef)

now you can run termiauth anywhere in your pc by just typing this in any terminal
```bash
termiauth
```

no stupid tracking — just a minimal terminal authenticator app :)

---

## version history

* **v1.0** — the base app with passphrase protection
* **v1.1** — added security question recovery for forgotten passphrases
* **v1.2** — added hashed and salted storage so even if someone gets on your machine, your secrets stay safer \:D

---

*feel free to open issues or pull requests on github if you want to chat or request features!*
