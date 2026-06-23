# Finalni izveštaj AI agenta o rizicima projekta

## Izveštaj za SCRUM-10

**Analiza:** Kao Scrum Master, analiziraću kompleksnost zadatka "Registracija novog korisnika" sa opisom "Korisnik treba da unese email i lozinku".

---

**Nivo kompleksnosti: Srednji**

**Objašnjenje:**

Iako se na prvi pogled čini kao jednostavan zadatak (dva polja i dugme), registracija novog korisnika nosi sa sobom značajnu kompleksnost zbog inherentnih sigurnosnih i funkcionalnih zahteva koji su neophodni za bilo koju produkcionu aplikaciju.

Evo zašto je nivo kompleksnosti Srednji:

1.  **Validacija unosa (Frontend i Backend):**
    *   **Format emaila:** Provera da li je uneti email u ispravnom formatu (npr. `ime@domen.com`).
    *   **Jačina lozinke:** Provera da li lozinka ispunjava određene kriterijume (minimalna dužina, kombinacija velikih/malih slova, brojeva, specijalnih karaktera). Ovo može biti prilično kompleksno za implementaciju i testiranje.
    *   **Podudarnost lozinki:** Ako postoji polje "Potvrdi lozinku", mora se proveriti da li se lozinke podudaraju.
    *   **Obavezna polja:** Provera da li su oba polja popunjena.
    *   *Zašto je ovo kompleksno:* Sve ove validacije moraju biti implementirane i na klijentskoj strani (za bolje korisničko iskustvo) i obavezno na serverskoj strani (zbog sigurnosti i integriteta podataka).

2.  **Sigurnost lozinke (Backend):**
    *   **Heširanje lozinke:** Lozinke se nikada ne smeju čuvati u bazi podataka u čistom tekstualnom obliku. Moraju se heširati korišćenjem jakih, jednosmernih algoritama (npr. bcrypt, scrypt, Argon2) sa "soli" (salt). Ovo je kritičan sigurnosni zahtev i njegova ispravna implementacija nije trivijalna.
    *   *Zašto je ovo kompleksno:* Pogrešna implementacija heširanja može dovesti do ozbiljnih sigurnosnih propusta.

3.  **Interakcija sa bazom podataka (Backend):**
    *   **Provera jedinstvenosti emaila:** Pre nego što se novi korisnik upiše, mora se proveriti da li email adresa već postoji u bazi podataka. Ako postoji, korisniku se mora vratiti odgovarajuća poruka o grešci.
    *   **Upisivanje novog korisnika:** Kreiranje novog zapisa u tabeli korisnika sa heširanom lozinkom i ostalim podacima.
    *   *Zašto je ovo kompleksno:* Zahteva poznavanje baze podataka, SQL-a ili ORM-a, kao i efikasno rukovanje transakcijama.

4.  **Rukovanje greškama i povratne informacije korisniku:**
    *   Sistem mora jasno i razumljivo obavestiti korisnika o svim greškama (npr. "Email je već zauzet", "Lozinka nije dovoljno jaka", "Email format nije ispravan").
    *   *Zašto je ovo kompleksno:* Zahteva pažljivo dizajnirane poruke o greškama i logiku za njihovo prikazivanje na korisničkom interfejsu.

5.  **Potencijalni dodatni zahtevi (često se dodaju kasnije, ali su deo "registracije"):**
    *   **Verifikacija email adrese:** Slanje verifikacionog linka na uneti email kako bi se potvrdilo vlasništvo nad adresom. Ovo uključuje integraciju sa servisom za slanje emailova, generisanje jedinstvenih tokena, čuvanje statusa verifikacije u bazi i obradu verifikacionog linka.
    *   **Slanje dobrodošlice:** Slanje emaila dobrodošlice nakon uspešne registracije.
    *   *Zašto je ovo kompleksno:* Dodaje integracije sa eksternim servisima i dodatnu logiku.

6.  **Testiranje:**
    *   Potrebno je temeljno testiranje svih scenarija: uspešna registracija, neispravan email, slaba lozinka, email već postoji, prazna polja, itd. Takođe, sigurnosno testiranje je ključno.
    *   *Zašto je ovo kompleksno:* Obim testiranja je veći nego za jednostavne CRUD operacije.

**Zaključak:**

Zadatak "Registracija novog korisnika" prevazilazi "Nizak" nivo kompleksnosti jer zahteva implementaciju kritičnih sigurnosnih mehanizama (heširanje lozinke), robusnu validaciju na više nivoa i interakciju sa bazom podataka sa proverom jedinstvenosti. Nije "Visok" nivo jer se radi o dobro poznatom obrascu sa standardnim rešenjima, ali zahteva pažljivu i ispravnu implementaciju kako bi se osigurala funkcionalnost i sigurnost sistema.

**Rizici:** Na osnovu analize kompleksnosti zadatka "Registracija novog korisnika", evo 2 specifična MSF rizika (fokusirajući se na sigurnost, ranjivost i potencijalne pretnje) za online prodavnicu mangi:

1.  **Rizik: Nedovoljno sigurno heširanje lozinki i skladištenje korisničkih podataka.**
    *   **Objašnjenje:** Analiza jasno naglašava da se lozinke "nikada ne smeju čuvati u bazi podataka u čistom tekstualnom obliku" i da "pogrešna implementacija heširanja može dovesti do ozbiljnih sigurnosnih propusta". U kontekstu online prodavnice mangi, ako se lozinke ne heširaju pravilno (npr. korišćenjem slabih algoritama, bez "soli" ili, u najgorem slučaju, u čistom tekstu), potencijalni napadač koji uspe da pristupi bazi podataka (npr. putem SQL injekcije ili drugog propusta) mogao bi:
        *   **Direktno kompromitovati korisničke naloge:** Pristupiti nalozima korisnika u prodavnici.
        *   **Izvršiti "credential stuffing" napade:** Koristeći ukradene email adrese i lozinke, pokušati da pristupi nalozima istih korisnika na drugim popularnim platformama (banke, društvene mreže), s obzirom na to da mnogi korisnici koriste iste lozinke.
        *   **Narušiti reputaciju prodavnice:** Veliki sigurnosni incident bi drastično smanjio poverenje kupaca i doveo do gubitka poslovanja.
    *   **Veza sa analizom:** Direktno proističe iz tačke 2. "Sigurnost lozinke (Backend)" i indirektno iz tačke 3. "Interakcija sa bazom podataka (Backend)".

2.  **Rizik: Mogućnost kreiranja lažnih ili spam naloga usled nedostatka verifikacije email adrese.**
    *   **Objašnjenje:** Analiza navodi "Verifikacija email adrese" kao "potencijalni dodatni zahtev" koji dodaje kompleksnost. Ako se ovaj korak izostavi ili se implementira neadekvatno, online prodavnica mangi je izložena riziku od:
        *   **Zagađenja baze podataka:** Botovi ili zlonamerni akteri mogu masovno registrovati naloge koristeći nepostojeće ili tuđe email adrese. Ovo opterećuje sistem, stvara lažne podatke i otežava analizu korisničke baze.
        *   **Zloupotrebe za spam:** Lažni nalozi se mogu koristiti za slanje neželjenih poruka drugim korisnicima (ako postoji interna komunikacija), postavljanje spam komentara na proizvode ili zloupotrebu promotivnih kodova.
        *   **Potencijalne prevare:** Iako manje direktno, ako se registracija može obaviti sa tuđim emailom bez verifikacije, to otvara vrata za primanje "password reset" linkova na tuđi email, što može dovesti do preuzimanja naloga na drugim servisima ako se lozinke dele.
        *   **Opterećenje resursa:** Veliki broj lažnih registracija može dovesti do preopterećenja servera i baze podataka, što utiče na performanse za legitimne korisnike.
    *   **Veza sa analizom:** Direktno proističe iz tačke 5. "Potencijalni dodatni zahtevi (često se dodaju kasnije, ali su deo 'registracije')" – konkretno "Verifikacija email adrese".

**Preporuke:**
Odlična analiza rizika! Evo predloga Plan B (kontingencije) u tabelarnom formatu za svaki od navedenih rizika:

---

### Plan B (Kontingencija) za MSF Rizike

Ovaj plan definiše korake koje treba preduzeti u slučaju da se detektuje ili posumnja na ostvarenje navedenih sigurnosnih rizika.

---

#### Rizik 1: Nedovoljno sigurno heširanje lozinki i skladištenje korisničkih podataka.

| Kategorija | Opis Plana B (Kontingencija) | Okidač (Trigger) | Odgovorna Strana | Potrebni Resursi | Plan Komunikacije |
| :--------- | :--------------------------- | :---------------- | :--------------- | :--------------- | :---------------- |
| **1. Detekcija i Izolacija** | **1.1. Trenutna izolacija:** Isključiti pristup bazi podataka sa lozinkama ili celom sistemu ako je kompromitacija široka. <br> **1.2. Forenzička analiza:** Pokrenuti detaljnu istragu kako je došlo do upada, koje su informacije kompromitovane i u kojoj meri. | - Detekcija neautorizovanog pristupa bazi podataka. <br> - Obaveštenje od sigurnosnog istraživača ili treće strane. <br> - Neuobičajena aktivnost na serverima ili u bazi podataka. | - CTO / Vođa razvojnog tima <br> - Sigurnosni inženjer / DevOps | - Sigurnosni alati za monitoring <br> - Forenzički alati <br> - Eksterni sigurnosni konsultanti (po potrebi) | - Interna komunikacija sa menadžmentom i pravnim timom. |
| **2. Sanacija i Popravka** | **2.1. Prinudno resetovanje lozinki:** Svi korisnici moraju biti primorani da resetuju svoje lozinke pri sledećoj prijavi. <br> **2.2. Implementacija jakog heširanja:** Odmah implementirati i primeniti industrijski standardne algoritme za heširanje (npr. Argon2, bcrypt, scrypt) sa adekvatnom "soli" i "pepperom". <br> **2.3. Sigurnosna revizija:** Izvršiti kompletnu sigurnosnu reviziju celog sistema, sa fokusom na ranjivosti koje su dovele do incidenta. | - Potvrđena kompromitacija lozinki. <br> - Završetak forenzičke analize. | - Vođa razvojnog tima <br> - Backend developeri <br> - Sigurnosni inženjer | - Vreme razvojnog tima <br> - Budžet za sigurnosne alate/usluge | - Nema eksterne komunikacije dok se ne reši problem. |
| **3. Obaveštavanje Korisnika** | **3.1. Javno obaveštenje:** Objaviti transparentno obaveštenje na sajtu i putem emaila svim pogođenim korisnicima o incidentu, koracima koje su preduzeti i preporukama za njih (npr. promena lozinke i na drugim servisima). <br> **3.2. Podrška korisnicima:** Pripremiti tim za korisničku podršku za povećan broj upita. | - Sistem je saniran i spreman za ponovno puštanje u rad. <br> - Pravni tim odobrio tekst obaveštenja. | - Marketing/PR menadžer <br> - Pravni savetnik <br> - Tim za korisničku podršku | - Platforme za slanje emaila <br> - Web sajt <br> - Obučeno osoblje za podršku | - Email obaveštenja <br> - Objava na sajtu/blogu <br> - Objava na društvenim mrežama |
| **4. Prevencija i Učenje** | **4.1. Post-mortem analiza:** Detaljna analiza incidenta radi identifikacije korena problema i poboljšanja budućih sigurnosnih praksi. <br> **4.2. Redovne sigurnosne provere:** Uvesti redovne penetracione testove i sigurnosne revizije. <br> **4.3. Obuka tima:** Edukacija razvojnog tima o najnovijim sigurnosnim praksama. | - Završetak sanacije i obaveštavanja. | - CTO / Vođa razvojnog tima <br> - Sigurnosni inženjer | - Vreme tima <br> - Budžet za obuku i testiranje | - Interni izveštaji i sastanci. |

---

#### Rizik 2: Mogućnost kreiranja lažnih ili spam naloga usled nedostatka verifikacije email adrese.

| Kategorija | Opis Plana B (Kontingencija) | Okidač (Trigger) | Odgovorna Strana | Potrebni Resursi | Plan Komunikacije |
| :--------- | :--------------------------- | :---------------- | :--------------- | :--------------- | :---------------- |
| **1. Detekcija i Potvrda** | **1.1. Monitoring metrika:** Praćenje naglog skoka u broju registracija, neobično visokog broja neaktivnih naloga, ili povećanog broja "bounce" emailova. <br> **1.2. Ručna provera:** Nasumična provera novih naloga i njihovih aktivnosti. | - Nagli skok u broju registracija (npr. >X% u 24h). <br> - Prijave korisnika o spam komentarima/porukama. <br> - Visok procenat neaktivnih naloga nakon registracije. | - Data analitičar <br> - Tim za podršku/moderaciju | - Alati za analizu logova <br> - Baza podataka <br> - Alati za monitoring | - Interna komunikacija sa razvojnim i marketing timom. |
| **2. Sanacija i Prevencija** | **2.1. Implementacija verifikacije email adrese:** Odmah uvesti obaveznu verifikaciju email adrese putem linka poslatog na email. <br> **2.2. Implementacija CAPTCHA/reCAPTCHA:** Dodati CAPTCHA ili sličan mehanizam na stranicu za registraciju. <br> **2.3. Čišćenje baze podataka:** Identifikovati i obrisati lažne/spam naloge (na osnovu IP adrese, email domena, neaktivnosti, itd.). <br> **2.4. Ograničenje stope (Rate Limiting):** Implementirati ograničenje broja registracija sa iste IP adrese u određenom vremenskom periodu. | - Potvrđeno postojanje značajnog broja lažnih/spam naloga. <br> - Visok nivo zloupotrebe. | - Vođa razvojnog tima <br> - Backend developeri <br> - Data analitičar | - Vreme razvojnog tima <br> - Servis za slanje emaila <br> - CAPTCHA servis (npr. Google reCAPTCHA) | - Interna komunikacija o napretku implementacije. |
| **3. Praćenje i Optimizacija** | **3.1. Kontinuirano praćenje:** Nastaviti sa praćenjem metrika registracije i aktivnosti naloga. <br> **3.2. A/B testiranje:** Testirati različite pristupe verifikaciji i CAPTCHA rešenjima radi optimizacije korisničkog iskustva i sigurnosti. <br> **3.3. Unapređenje algoritama:** Razvijati ili koristiti naprednije algoritme za detekciju botova i lažnih naloga. | - Implementacija rešenja je završena. <br> - Smanjenje broja lažnih naloga. | - Data analitičar <br> - Vođa razvojnog tima <br> - Marketing tim | - Alati za analizu <br> - A/B testiranje platforme | - Interni izveštaji o efikasnosti mera. |
| **4. Komunikacija (Interna/Eksterna)** | **4.1. Interna obaveštenja:** Obavestiti sve relevantne timove (podrška, marketing) o preduzetim merama i njihovom uticaju. <br> **4.2. Eksterna komunikacija (po potrebi):** Ako je došlo do zloupotrebe koja je uticala na legitimne korisnike (npr. spam poruke), obavestiti ih o rešenju problema i merama za sprečavanje budućih incidenata. | - Završetak sanacije i implementacije. <br> - Ako su legitimni korisnici pogođeni. | - Marketing/PR menadžer <br> - Tim za korisničku podršku | - Platforme za slanje emaila <br> - Web sajt | - Interni sastanci <br> - Email obaveštenja (samo ako je neophodno) |

---
---

## Izveštaj za SCRUM-14

**Analiza:** Kao Scrum Master, analizirao bih kompleksnost zadatka "Realizacija kupovine preko Stripe servisa" na sledeći način:

**Nivo kompleksnosti: Visok**

**Objašnjenje:**

Iako opis "Korisnik unosi podatke sa kartice u Stripe formi" sugeriše da Stripe preuzima veliki deo posla oko PCI DSS usklađenosti (što je velika prednost), sama integracija i realizacija kompletne kupovine je daleko od jednostavne i obuhvata više slojeva kompleksnosti:

1.  **Integracija sa eksternim servisom (Stripe API):**
    *   **Razumevanje Stripe ekosistema:** Nije dovoljno samo poslati podatke. Potrebno je razumeti koncepte kao što su Payment Intents, Charges, Customers, Products, Webhooks, itd.
    *   **API pozivi:** Implementacija server-side logike za kreiranje Payment Intents-a, potvrđivanje plaćanja, rukovanje odgovorima od Stripe-a.
    *   **Autentifikacija:** Sigurno rukovanje Stripe API ključevima.

2.  **Frontend implementacija:**
    *   **Stripe Elements/Checkout integracija:** Iako Stripe pruža gotove komponente, njihova integracija zahteva poznavanje Stripe.js biblioteke, rukovanje callback-ovima, prikazivanje grešaka i statusa korisniku.
    *   **Korisničko iskustvo (UX):** Osiguravanje glatkog toka plaćanja, jasne poruke o uspehu/neuspjehu, preusmeravanje.
    *   **Rukovanje 3D Secure autentifikacijom (SCA):** Moderni zahtevi često uključuju 3D Secure, što dodaje dodatni korak u toku plaćanja (preusmeravanje korisnika na banku, pa nazad), što mora biti pravilno implementirano i na frontendu i na backendu.

3.  **Backend logika i baza podataka:**
    *   **Upravljanje statusima narudžbine:** Ažuriranje statusa narudžbine u bazi podataka (npr. "pending", "paid", "failed", "refunded") na osnovu odgovora od Stripe-a.
    *   **Čuvanje transakcionih podataka:** Sigurno čuvanje relevantnih Stripe ID-jeva (Payment Intent ID, Charge ID) za buduće reference, refundacije ili rešavanje problema.
    *   **Webhooks:** Implementacija i obrada Stripe Webhook-ova je ključna za robustan sistem. Omogućava asinhronu obradu događaja (npr. potvrda plaćanja, refundacija, sporovi) i osigurava da je stanje u našoj aplikaciji uvek sinhronizovano sa Stripe-om, čak i ako dođe do problema tokom inicijalnog plaćanja. Ovo dodaje značajnu kompleksnost.

4.  **Rukovanje greškama i izuzecima:**
    *   **Širok spektar grešaka:** Kartica odbijena (nedovoljno sredstava, istekla, pogrešan CVV), tehničke greške na Stripe strani, mrežne greške, prevare. Svaki scenario zahteva specifično rukovanje i informisanje korisnika.
    *   **Logovanje:** Detaljno logovanje svih transakcija i grešaka za debagovanje i analizu.

5.  **Sigurnost:**
    *   Iako Stripe rukuje osetljivim podacima kartice, naša server-side implementacija mora biti sigurna, posebno u pogledu zaštite API ključeva i validacije podataka.

6.  **Testiranje:**
    *   **Unit i integracioni testovi:** Za backend logiku i interakciju sa Stripe API-jem (koristeći test ključeve i mock-ove).
    *   **End-to-end testovi:** Za ceo tok kupovine, uključujući frontend interakciju i backend obradu.
    *   **Testiranje različitih scenarija:** Uspešna plaćanja, odbijene kartice, 3D Secure izazovi, mrežne greške.

**Zaključak:**

Zadatak realizacije kupovine preko Stripe-a, iako olakšan upotrebom njihovih formi, zahteva duboko razumevanje eksternog servisa, implementaciju na oba kraja (frontend i backend), robusno rukovanje greškama, sigurnosne aspekte i temeljno testiranje. Sve ovo čini zadatak značajno kompleksnim i svrstava ga u kategoriju "Visok". Potrebno je značajno vreme za planiranje, implementaciju i testiranje kako bi se osigurala pouzdana i sigurna funkcionalnost.

**Rizici:** Na osnovu date analize kompleksnosti zadatka "Realizacija kupovine preko Stripe servisa" za online prodavnicu mangi, identifikovao bih sledeća 2 specifična MSF rizika:

1.  **Tehnički rizik: Neadekvatna ili nekompletna implementacija Stripe Webhook-ova.**
    *   **Objašnjenje:** Analiza naglašava da su "Webhooks ključni za robustan sistem" i da dodaju "značajnu kompleksnost". Ako webhooks nisu pravilno implementirani i obrađeni (npr. za praćenje statusa plaćanja, refundacija, sporova), aplikacija online prodavnice mangi neće moći pouzdano da prati stvarni status transakcije. To može dovesti do situacija gde korisnik plati mangu, ali sistem ne ažurira status narudžbine na "plaćeno", što rezultira neisporukom digitalnog sadržaja, frustracijom korisnika i potrebom za skupom ručnom intervencijom i podrškom.

2.  **Operativni rizik: Visoka stopa napuštanja korpe (cart abandonment) zbog lošeg korisničkog iskustva tokom procesa plaćanja.**
    *   **Objašnjenje:** Iako Stripe forme olakšavaju unos podataka, analiza ističe važnost "Korisničkog iskustva (UX)" i "Rukovanja greškama i izuzecima". Ako se tokom implementacije ne posveti dovoljno pažnje jasnim porukama o uspehu/neuspjehu plaćanja, brzom odzivu sistema ili glatkom rukovanju 3D Secure autentifikacijom, korisnici mogu biti frustrirani. U kontekstu online prodavnice mangi, gde je impulsivna kupovina česta, svaka prepreka ili nejasnoća u procesu plaćanja može dovesti do toga da potencijalni kupci odustanu od kupovine, direktno utičući na prihode i zadovoljstvo korisnika.

**Preporuke:**
Odlično identifikovani rizici! Sada ćemo za svaki od njih predložiti Plan B (kontingenciju) u formatu tabele, fokusirajući se na akcije koje se preduzimaju *nakon* što se rizik materijalizuje.

---

### Plan B (Kontingencija) za identifikovane MSF rizike

| Kategorija | Rizik | Okidač (Trigger) | Plan B (Kontingentne Akcije) | Odgovornost | Potrebni Resursi | Metrika Uspeha |
| :--------- | :---- | :---------------- | :--------------------------- | :----------- | :--------------- | :-------------- |
| **Tehnički** | **1. Neadekvatna ili nekompletna implementacija Stripe Webhook-ova.** | - Povećan broj pritužbi korisnika o neisporučenim mangama nakon plaćanja. <br> - Discrepancija između statusa plaćanja na Stripe dashboardu i internog statusa narudžbine. <br> - Logovi sistema pokazuju greške u obradi webhook poziva ili izostanak istih. | **1. Detekcija i Monitoring:** <br> &nbsp;&nbsp;&nbsp;&nbsp;a. Implementirati automatske alarme za neuspešne webhook pozive i neusaglašenosti statusa. <br> &nbsp;&nbsp;&nbsp;&nbsp;b. Redovno proveravati Stripe Event Logs i upoređivati sa internim logovima. <br> **2. Ručna Verifikacija i Korekcija:** <br> &nbsp;&nbsp;&nbsp;&nbsp;a. Tim za podršku dobija proceduru za ručnu proveru statusa plaćanja na Stripe dashboardu za svaku spornu narudžbinu. <br> &nbsp;&nbsp;&nbsp;&nbsp;b. Ručno ažuriranje statusa narudžbine u internom sistemu i pokretanje isporuke digitalnog sadržaja. <br> &nbsp;&nbsp;&nbsp;&nbsp;c. U slučaju greške, pokrenuti ručni refund (ako je potrebno) i obavestiti korisnika. <br> **3. Komunikacija sa Korisnikom:** <br> &nbsp;&nbsp;&nbsp;&nbsp;a. Proaktivno obaveštavanje korisnika o problemu, izvinjenje i objašnjenje koraka koji se preduzimaju. <br> &nbsp;&nbsp;&nbsp;&nbsp;b. Ponuditi kompenzaciju (npr. mali popust na sledeću kupovinu) za pretrpljenu neprijatnost. <br> **4. Analiza uzroka i Privremeno Rešenje:** <br> &nbsp;&nbsp;&nbsp;&nbsp;a. Tim za razvoj odmah analizira logove i kod kako bi identifikovao koren problema. <br> &nbsp;&nbsp;&nbsp;&nbsp;b. Implementirati privremeno rešenje (npr. batch skripta koja periodično proverava Stripe transakcije i sinhronizuje statuse) dok se trajno rešenje ne implementira. | DevOps tim, <br> Tim za podršku, <br> Razvojni tim | Alati za monitoring (npr. Sentry, Datadog), <br> Pristup Stripe dashboardu, <br> Interni alati za administraciju narudžbina, <br> Sistem za slanje emailova korisnicima. | - Smanjenje broja pritužbi korisnika. <br> - Smanjenje vremena za rešavanje problema po narudžbini. <br> - Usklađenost statusa plaćanja između Stripe-a i internog sistema. |
| **Operativni** | **2. Visoka stopa napuštanja korpe (cart abandonment) zbog lošeg korisničkog iskustva tokom procesa plaćanja.** | - Nagli pad konverzije na stranici za plaćanje. <br> - Povećan broj nedovršenih transakcija u analitici. <br> - Direktne povratne informacije korisnika o problemima tokom plaćanja (putem podrške ili društvenih mreža). | **1. Detekcija i Analiza:** <br> &nbsp;&nbsp;&nbsp;&nbsp;a. Pojačano praćenje konverzionog levka (funnel) i identifikacija tačnih mesta napuštanja. <br> &nbsp;&nbsp;&nbsp;&nbsp;b. Korišćenje alata za snimanje sesija (session recording) i heatmaps za vizuelnu analizu ponašanja korisnika. <br> &nbsp;&nbsp;&nbsp;&nbsp;c. Brze A/B testove za male promene u UX-u (npr. tekst dugmeta, pozicija polja). <br> **2. Kampanje za Oporavak:** <br> &nbsp;&nbsp;&nbsp;&nbsp;a. Implementirati ili pojačati "abandoned cart" email kampanje sa jasnim pozivom na akciju i eventualno malim podsticajem (npr. popust za 5% ako završe kupovinu u narednih 24h). <br> &nbsp;&nbsp;&nbsp;&nbsp;b. Retargeting kampanje na društvenim mrežama za korisnike koji su napustili korpu. <br> **3. Prikupljanje Povratnih Informacija:** <br> &nbsp;&nbsp;&nbsp;&nbsp;a. Kratke ankete na stranici za napuštanje korpe ili putem emaila, pitajući za razlog odustajanja. <br> &nbsp;&nbsp;&nbsp;&nbsp;b. Fokus grupe ili intervjui sa malim brojem korisnika radi dubljeg razumevanja problema. <br> **4. Privremene Mere i Brza Poboljšanja:** <br> &nbsp;&nbsp;&nbsp;&nbsp;a. Razmotriti dodavanje alternativnih, popularnih metoda plaćanja (ako je moguće i brzo za implementaciju). <br> &nbsp;&nbsp;&nbsp;&nbsp;b. Pojednostaviti formu za plaćanje (npr. ukloniti neobavezna polja). <br> &nbsp;&nbsp;&nbsp;&nbsp;c. Osigurati da su poruke o greškama jasne i korisne. | Marketing tim, <br> UX/UI dizajner, <br> Razvojni tim | Alati za web analitiku (npr. Google Analytics), <br> Alati za snimanje sesija (npr. Hotjar), <br> Platforma za email marketing, <br> Alati za A/B testiranje, <br> Resursi za UX istraživanje. | - Povećanje stope konverzije na stranici za plaćanje. <br> - Smanjenje stope napuštanja korpe. <br> - Pozitivne povratne informacije korisnika. |

---

Ovaj plan kontingencije pruža konkretne korake koje tim može preduzeti kada se identifikovani rizici materijalizuju, sa ciljem minimiziranja štete i brzog oporavka. Važno je da se ovi planovi redovno pregledaju i ažuriraju.
---

## Izveštaj za SCRUM-16

**Analiza:** Kao Scrum Master, analizirao bih kompleksnost zadatka "Integracija sa Stripe API: Povezivanje backend servisa sa Stripe testnim okruženjem" i ocenio ga kao **Srednji** nivo kompleksnosti.

Evo zašto:

**Nivo: Srednji**

**Objašnjenje:**

1.  **Nije Nizak zato što:**
    *   **Nije "Hello World" poziv:** Iako je u pitanju testno okruženje, integracija sa platnim procesorom nikada nije trivijalna. Ne radi se samo o jednom API pozivu.
    *   **Razumevanje koncepata:** Potrebno je razumeti Stripe koncepte kao što su `PaymentIntents`, `Customers`, `PaymentMethods`, `Charges` (iako se `PaymentIntents` preferiraju), kao i tokove plaćanja.
    *   **Sigurnost API ključeva:** Čak i u testnom okruženju, potrebno je pravilno upravljati API ključevima (secret keys) i osigurati da ne procure.
    *   **Rukovanje greškama:** Neophodno je implementirati robusno rukovanje greškama koje mogu nastati tokom komunikacije sa Stripe-om (npr. mrežni problemi, nevažeći podaci, odbijene transakcije).

2.  **Nije Visok zato što:**
    *   **Testno okruženje:** Rad u testnom okruženju značajno smanjuje rizik od finansijskih gubitaka i omogućava slobodnije eksperimentisanje bez straha od "pravog novca".
    *   **Dobra dokumentacija i SDK-ovi:** Stripe ima izuzetno kvalitetnu i detaljnu dokumentaciju, kao i zvanične biblioteke (SDK-ove) za većinu popularnih programskih jezika, što drastično olakšava implementaciju.
    *   **Fokus na backend:** Opis "povezivanje backend servisa" sugeriše da se primarni fokus stavlja na serversku logiku, što može izostaviti kompleksnost frontend integracije (npr. Stripe Elements za prikupljanje kartičnih podataka, što bi dodalo složenost PCI DSS usklađenosti ako se ne koristi na pravi način).

3.  **Zašto Srednji:**
    *   **Osnovna funkcionalnost:** Tipična integracija podrazumeva implementaciju sledećih koraka na backendu:
        *   **Autentifikacija:** Korišćenje Stripe API ključeva.
        *   **Kreiranje transakcije:** Npr. kreiranje `PaymentIntent`-a za jednokratno plaćanje.
        *   **Rukovanje odgovorima:** Obrada uspešnih i neuspešnih transakcija.
        *   **Webhooks:** Ovo je ključna komponenta. Za robusnu integraciju, backend mora biti u stanju da prima i obrađuje Stripe webhooks (npr. za obaveštenja o uspešnim plaćanjima, povraćajima, promenama statusa). Implementacija webhook endpointa i njegova sigurnost (validacija potpisa) dodaje složenost.
        *   **Idempotencija:** Osiguravanje da se API pozivi mogu ponavljati bez neželjenih duplih efekata.
        *   **Testiranje:** Potrebno je razviti strategiju testiranja za integraciju sa Stripe testnim okruženjem.
    *   **Potencijal za eskalaciju:** Iako je početna integracija srednja, vrlo brzo može postati visoka ako se zahtevi prošire na:
        *   **Pretplate (Subscriptions):** Kompleksniji tokovi, upravljanje planovima, ciklusima naplate.
        *   **Povraćaji novca (Refunds):** Implementacija logike za obradu povraćaja.
        *   **Više metoda plaćanja:** Podrška za različite metode plaćanja (SEPA, iDEAL, itd.).
        *   **SCA (Strong Customer Authentication):** Implementacija 3D Secure protokola za evropske transakcije.
        *   **Kompleksna obrada grešaka:** Detaljniji retry mehanizmi, obaveštenja administratora.
        *   **Integracija sa frontendom:** Ako backend mora da sarađuje sa frontendom koji koristi Stripe Elements ili Checkout, to dodaje sloj koordinacije i razumevanja.

**Zaključak za tim:**
Kao Scrum Master, savetovao bih tim da se fokusira na jasne zahteve za prvu iteraciju integracije. Treba definisati minimalni set funkcionalnosti (npr. samo jednokratno plaćanje i obrada uspešnog webhooka) kako bi se zadržala srednja kompleksnost. Svako proširenje funkcionalnosti (pretplate, povraćaji, više metoda plaćanja) treba tretirati kao zasebne PBI-je (Product Backlog Items) koji će povećati ukupnu kompleksnost projekta. Obavezno je uključiti vreme za razumevanje Stripe dokumentacije i implementaciju sigurnosnih praksi.

**Rizici:** Na osnovu analize kompleksnosti integracije sa Stripe API-jem i konteksta online prodavnice mangi, identifikovao bih sledeća 2 specifična MSF rizika:

1.  **Rizik: Neusklađenost statusa plaćanja i isporuke digitalnog sadržaja (MSF Kategorija: Proizvod / Tehnologija)**
    *   **Objašnjenje:** Iako je integracija sa Stripe-om ocenjena kao srednja, postoji značajan rizik da se status plaćanja u Stripe sistemu (npr. `PaymentIntent` uspešno obrađen) ne sinhronizuje pravilno sa internim sistemom prodavnice mangi. To može dovesti do situacija gde je korisnik platio za mangu, ali mu ona nije otključana/dostupna u aplikaciji, ili obrnuto – da je manga otključana bez uspešne naplate. Ovo je direktno povezano sa potrebom za robusnim rukovanjem greškama, implementacijom webhooks-a i idempotencije, kako je navedeno u analizi.
    *   **Specifičnost za prodavnicu mangi:** Direktno utiče na korisničko iskustvo i poverenje. Frustrirani korisnici koji ne dobiju plaćeni sadržaj mogu dovesti do negativnih recenzija, zahteva za povraćajem novca i gubitka reputacije.

2.  **Rizik: Sigurnosni propusti i rizik od prevara (fraud) (MSF Kategorija: Tehnologija / Eksterni faktori)**
    *   **Objašnjenje:** Analiza naglašava važnost sigurnosti API ključeva i potencijalnu složenost implementacije SCA (Strong Customer Authentication). Čak i u testnom okruženju, loše prakse mogu preći u produkciju. Rizik se odnosi na mogućnost kompromitovanja API ključeva, ranjivosti u webhook implementaciji (npr. nevalidacija potpisa) ili neadekvatnu zaštitu od prevara. Online prodavnice, posebno one sa digitalnim dobrima, često su meta prevaranata koji koriste ukradene kartice.
    *   **Specifičnost za prodavnicu mangi:** Kompromitovani podaci o plaćanju korisnika mogu dovesti do masovnih finansijskih gubitaka, pravnih posledica (npr. GDPR), gubitka poverenja korisnika i reputacione štete. Povećan broj povraćaja novca (chargebacks) zbog prevara može dovesti do blokade Stripe naloga.

**Preporuke:**
Odlično identifikovani rizici! Sada ćemo kreirati Plan B (kontingenciju) u formatu tabele za svaki od njih.

---

### Plan B (Kontingencija) za identifikovane MSF rizike

Ovaj plan opisuje korake koje treba preduzeti ukoliko se identifikovani rizici materijalizuju, sa ciljem minimiziranja štete i brzog oporavka.

| Rizik | Opis Rizika | Okidač / Indikator | Plan B / Kontingencija | Odgovornost | Prioritet |
| :---------------------------------------- | :------------------------------------------------------------------------------------------------------------------------ Risk: **Neusklađenost statusa plaćanja i isporuke digitalnog sadržaja** (MSF Kategorija: Proizvod / Tehnologija)

*   **Objašnjenje:** Iako je integracija sa Stripe-om ocenjena kao srednja, postoji značajan rizik da se status plaćanja u Stripe sistemu (npr. `PaymentIntent` uspešno obrađen) ne sinhronizuje pravilno sa internim sistemom prodavnice mangi. To može dovesti do situacija gde je korisnik platio za mangu, ali mu ona nije otključana/dostupna u aplikaciji, ili obrnuto – da je manga otključana bez uspešne naplate. Ovo je direktno povezano sa potrebom za robusnim rukovanjem greškama, implementacijom webhooks-a i idempotencije, kako je navedeno u analizi.
*   **Specifičnost za prodavnicu mangi:** Direktno utiče na korisničko iskustvo i poverenje. Frustrirani korisnici koji ne dobiju plaćeni sadržaj mogu dovesti do negativnih recenzija, zahteva za povraćajem novca i gubitka reputacije.

---

Risk: **Sigurnosni propusti i rizik od prevara (fraud)** (MSF Kategorija: Tehnologija / Eksterni faktori)

*   **Objašnjenje:** Analiza naglašava važnost sigurnosti API ključeva i potencijalnu složenost implementacije SCA (Strong Customer Authentication). Čak i u testnom okruženju, loše prakse mogu preći u produkciju. Rizik se odnosi na mogućnost kompromitovanja API ključeva, ranjivosti u webhook implementaciji (npr. nevalidacija potpisa) ili neadekvatnu zaštitu od prevara. Online prodavnice, posebno one sa digitalnim dobrima, često su meta prevaranata koji koriste ukradene kartice.
*   **Specifičnost za prodavnicu mangi:** Kompromitovani podaci o plaćanju korisnika mogu dovesti do masovnih finansijskih gubitaka, pravnih posledica (npr. GDPR), gubitka poverenja korisnika i reputacione štete. Povećan broj povraćaja novca (chargebacks) zbog prevara može dovesti do blokade Stripe naloga.

---
---