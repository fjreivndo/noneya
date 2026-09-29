# Breachpoint Desktop

Breachpoint in its own window, with a LAN relay built in.

## Run it

You need [Node.js](https://nodejs.org) 18 or newer.

```
npm install      # downloads Electron, about a minute
npm start
```

The game file (`Breachpoint v2.8.html`) must sit in this folder or the one
above it. Drop in a newer build and the app picks the newest one.

## Playing with friends

**Over the internet:** nothing to do here. In the game, Multiplayer → Host a
room gives you a 5-letter code; friends type it under Join. That works from
the plain HTML file in any browser too.

**On the same network, no internet:** this app also starts a relay on port
8080. In the game, Multiplayer shows a green "LAN relay running" box. Press
**Host on LAN**. Friends type the `ws://192.168.x.x:8080` address shown there
into the Join box. They can use this app or just open the HTML file.

The **LAN** menu copies the address for you.

## Options

```
npm start -- --port 9000       relay on another port
npm start -- --no-relay        game only
npm start -- --html "Breachpoint v2.8.html"
npm run relay                  relay only, no window (a spare PC can host)
```

## Making an installer

```
npm install --save-dev electron-builder
npx electron-builder
```

Copy the game HTML into this folder first. The installer lands in `dist/`.
