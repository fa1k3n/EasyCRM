Kundregistret – ett litet CRM som claude.ai-artifact
====================================================

Ett kundregister för ett litet företag: kunder och potentiella kunder, kontaktlogg med
påminnelse efter 60/90 dagar, jobb och fakturor, kundernas event, bokningar och uppföljningar.
Appen körs som en artifact på claude.ai, med artifactens inbyggda databas.

Företagets namn, logga, färger, typsnitt, avsändare och kundtyper kommer från en fil,
brand.json, som slås ihop med koden vid publicering. Repot innehåller bara det påhittade
exemplet Exempelstudion AB. Ditt eget varumärke (och eventuellt ett mailtillägg med färdiga
mailtexter) lägger du i mappen varumarke\ i din kopia av repot. Den ignoreras av git och
hamnar aldrig på GitHub.

Licens: MIT (se LICENSE).

Kom igång
---------
Kräver Node 24 (https://nodejs.org) och git, på Windows, macOS eller Linux.

1. Klona repot och installera npm-paketen (TypeScript, jest och playwright) i repots mapp:
     npm ci
2. Skapa din varumärkesmapp från exemplet (i repots mapp):
     Copy-Item exempel varumarke -Recurse
3. Fyll i varumarke\brand.json (fälten är förklarade i filen) och byt logo.svg mot din logga
   (png, svg, jpg eller webp, högst 1 MB).
4. Förhandsvisa med påhittade kunder (använder varumarke\ automatiskt):
     npm run preview
   och öppna sökvägen som skrivs ut.
5. Sätt ihop publiceringsmappen varumarke\publicera (kontrollerar brand.json, kör alla tester):
     npm run deploy
   (Med  npm run deploy -- --brand <mapp>  kan du använda en annan varumärkesmapp.)
6. Be Claude (Claude Code) publicera varumarke\publicera som en artifact:
   - index.html som sidan och de andra filerna (logic.js, brand.js, loggan, ev. mail.js) bredvid.
   - Databasen: capability db med regeln path "", read "admin", write "admin", så att bara du
     kommer åt kunderna.
   - Vid en ny version: publicera till samma artifact, läs först den publicerade versionen och
     läs tillbaka filerna efteråt för att jämföra med publiceringsmappen.

varumarke\ sparas inte i git och har ingen versionshistorik: säkerhetskopiera den själv,
t.ex. tillsammans med databasen.

Valfritt i varumärkesmappen:
- mail\mail.ts + mail\tsconfig.json: ett mailtillägg som skriver färdiga erbjudande- och
  uppföljningsmail (window.CRM_MAIL, kontraktet finns i kundregister\mail-api.d.ts). Utan
  tillägg loggar appen erbjudanden och uppföljningar utan färdig text.
- run-tests.js: egna tester, körs av deploy med  node run-tests.js --repo <repot>.

Innehåll
--------
kundregister\index.html        Appen (gränssnitt och databaskoppling)
kundregister\logic.ts          Ren logik i TypeScript: datum, kontaktstatus (60/90 dagar),
                               filter, sortering, event, kalenderposter, varumärke och färger.
                               Typerna beskriver också datamodellen.
kundregister\logic.js          Byggd från logic.ts (ändra aldrig för hand). Används av appen.
kundregister\mail-api.d.ts     Kontraktet för ett mailtillägg
kundregister\tsconfig.json     Inställningar för TypeScript
kundregister\tests\            Enhetstester för logiken (npx jest, eller öppna run.html i en webbläsare)
exempel\                       Exempel på varumärke (brand.json och logga)
tests\                         Tester för TypeScript-bygget, förhandsvisningen och deploy (jest)
tools\build.js                 Bygger logic.ts till logic.js med TypeScript 6.0.3 från npm
                               (npm run build; --project <mapp> bygger t.ex. ett mailtillägg)
package.json                   npm-projektet: exakta versioner av utvecklingsverktygen
                               (typescript, jest, playwright)
tools\preview.js               Förhandsvisar appen lokalt med påhittade kunder (npm run preview)
tools\deploy.js                Kontrollerar ett varumärke (brand.json), kör testerna och sätter
                               ihop publiceringsmappen (index.html, logic.js, brand.js, bilder,
                               ev. mail.js)
.github\workflows\ci.yml       GitHub Actions: alla tester vid varje push

Köra testerna
-------------
     npm ci        (en gång, och när package-lock.json ändrats)
     npm test

Först byggs och typkontrolleras logic.ts, sedan körs alla tester med jest: logikens tester
(i jsdom) och verktygens tester. Testerna har ett fast "idag" (2026-10-15), så resultatet
beror inte på vilken dag de körs. Du kan också öppna kundregister\tests\run.html direkt i
webbläsaren.
