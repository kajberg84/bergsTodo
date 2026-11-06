# Bergs Todo

An Android-first local todo app built with Expo, React Native, and strict TypeScript. Todos are stored on the device with AsyncStorage.

## Features

- Add and remove todos manually.
- Say `lägg till köp mjölk` or `ta bort köp mjölk` after tapping the microphone.
- Every todo has a visible number; say `ta bort nummer 2` to remove it.
- Swedish number words from `en`/`ett` through `tjugo` are also recognized.
- Say only `lägg till` or `ta bort`, then tap again and speak the todo when prompted.
- Speech recognition uses the Swedish `sv-SE` locale.

## Android development build

Voice recognition is a native module and is not included in Expo Go. In Git Bash, create and install a development APK:

```bash
cd /c/Kodning/bergsTodo
npx eas-cli login
npx eas-cli build --profile development --platform android
```

Open the resulting installation link on the phone and install the APK. Then run:

```bash
npm start
```

Open the installed Bergs Todo development app and connect to the server. JavaScript changes only need `npm start`; rebuild after native dependency or configuration changes.

## Checks

```bash
npm run typecheck
npx expo install --check
```

## Hands-free launching

Android does not let a normal Expo app own an always-listening custom wake word while closed. Use the system assistant to open Bergs Todo, then tap its microphone. A true always-on `BergsTodo` wake word needs a separate native Android hotword service, extra battery use, and privacy/store-policy work.
