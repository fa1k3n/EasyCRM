Kundregistret – ett litet CRM som claude.ai-artifact
====================================================

Ett kundregister för ett litet företag: kunder och potentiella kunder, kontaktlogg med
påminnelse efter 60/90 dagar, jobb och fakturor, kundernas event, bokningar och uppföljningar.
Appen körs som en artifact på claude.ai, med artifactens inbyggda databas.

Företagets namn, logga, färger, typsnitt, avsändare och kundtyper kommer från en fil,
brand.json, som slås ihop med koden vid publicering. Repot innehåller bara det påhittade
exemplet Exempelstudion AB. Ditt eget varumärke (och eventuellt ett mailtillägg med färdiga
mailtexter) lägger du i mappen profile\ i din kopia av repot. Den ignoreras av git och
hamnar aldrig på GitHub.

Licens: MIT (se LICENSE).

Kom igång
---------
Kräver Node 24 (https://nodejs.org) och git, på Windows, macOS eller Linux.

1. Klona repot och installera npm-paketen (TypeScript, jest och playwright) i repots mapp:
     npm ci
2. Skapa din varumärkesmapp från exemplet (i repots mapp):
     cp -r exempel profile
3. Fyll i profile\brand.json (fälten är förklarade i filen) och byt logo.svg mot din logga
   (png, svg, jpg eller webp, högst 1 MB).
4. Förhandsvisa med påhittade kunder (använder profile\ automatiskt):
     npm run preview
   och öppna sökvägen som skrivs ut.
5. Sätt ihop publiceringsmappen profile\publicera (kontrollerar brand.json, kör alla tester):
     npm run deploy
   (Med  npm run deploy -- --brand <mapp>  kan du använda en annan varumärkesmapp.)
6. Be Claude (Claude Code) publicera profile\publicera som en artifact:
   - index.html som sidan och de andra filerna (app.js, app.css, logic.js, brand.js och
     loggan) bredvid.
   - Databasen: capability db med regeln path "", read "admin", write "admin", så att bara du
     kommer åt kunderna.
   - Vid en ny version: publicera till samma artifact, läs först den publicerade versionen och
     läs tillbaka filerna efteråt för att jämföra med publiceringsmappen.

profile\ sparas inte i git och har ingen versionshistorik: säkerhetskopiera den själv,
t.ex. tillsammans med databasen.

Valfritt i varumärkesmappen:
- extensions\: tillägg till appen: egna sektioner på
  kundkortet, märken i kundlistan och färdiga mailtexter. Hur man skriver, testar, bygger och
  publicerar ett tillägg står (på engelska) i exempel\extensions\README.md, med exemplet
  "Nästa steg" i exempel\extensions\next-step\. Vill du inte ha exemplet: ta bort mappen.
- run-tests.js: egna tester, körs av deploy med  node run-tests.js --repo <repot>.

Innehåll
--------
app\                           Appen i React + TSX + Tailwind (byggs med npm run build, provas med
                               npm run preview och publiceras med npm run deploy). Tilläggs-API:t
                               finns i app\src\extensions\api.ts
kundregister\logic\            Ren logik i TypeScript, en modul per område: datum, kontaktstatus
                               (60/90 dagar), filter, sortering, event, kalenderposter, varumärke
                               och färger. types.ts beskriver datamodellen, index.ts är API:t.
kundregister\logic.js          Byggd från logic/ (ändra aldrig för hand). Används av appen.
kundregister\tsconfig.json     Inställningar för TypeScript
kundregister\tests\            Enhetstester för logiken (körs med jest)
exempel\                       Exempel på varumärke (brand.json och logga) och exempeltillägget
                               (extensions\, med README.md om hur man skriver tillägg)
tests\                         Tester för TypeScript-bygget, React-appens bygge,
                               förhandsvisningen och deploy (jest)
tools\build-app.js             Bygger React-appen (app\) med Vite till app.js, app.css och sidan
                               index.html (en del av npm run build)
tools\build.js                 Bygger logic/ till logic.js med TypeScript 6.0.3 från npm
                               (npm run build; --project <mapp> bygger en annan mapp med tsconfig.json)
package.json                   npm-projektet: exakta versioner av verktygen och paketen
                               (typescript, jest, playwright, react, vite, tailwind m.fl.)
tools\preview.js               Förhandsvisar appen lokalt med påhittade kunder (npm run preview)
tools\deploy.js                Kontrollerar ett varumärke (brand.json), kör testerna och sätter
                               ihop publiceringsmappen (index.html, app.js, app.css, logic.js,
                               brand.js och bilder)
.github\workflows\ci.yml       GitHub Actions: alla tester vid varje push

Köra testerna
-------------
     npm ci        (en gång, och när package-lock.json ändrats)
     npm test

Först byggs och typkontrolleras logic/ och React-appen, sedan körs alla tester med jest:
logikens tester (i jsdom), React-appens komponenttester och verktygens tester. Testerna har ett fast "idag" (2026-10-15), så resultatet
beror inte på vilken dag de körs.
