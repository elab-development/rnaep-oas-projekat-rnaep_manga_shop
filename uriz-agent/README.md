# AI Agent: JIRA Risk & Backlog Analyzer
**Projekat:** Online prodavnica mangi (URIZ 2026)
**Autor:** Miloš Kostić

## Opis projekta
Ovaj AI agent je razvijen kao menadžerski alat za automatizaciju analize rizika i prioritizaciju zadataka u okviru JIRA backlog-a [9, 10]. Agent koristi **Gemini 1.5 Flash** model i **LangChain** framework kako bi obradio korisničke zahteve (User Stories) i identifikovao kritične tačke u razvoju prodavnice mangi [11, 12].

## Funkcionalnosti i Workflow
Agent funkcioniše kroz višekoračni workflow (LCEL - LangChain Expression Language) [13, 14]:
1. **Analiza kompleksnosti:** LLM ocenjuje tehničku težinu zadatka na osnovu opisa.
2. **Identifikacija MSF rizika:** Na osnovu analize, agent mapira zadatak na specifične rizike iz MSF registra (npr. R06: Nedostupnost API-ja) [15, 16].
3. **Generisanje Plana B:** Agent kreira tabelarni prikaz mera kontingencije za identifikovane rizike [17].

## Instalacija i Pokretanje
1. Instalirajte Python (3.9+) i potrebne biblioteke:
   `py -m pip install -r requirements.txt`
2. Kreirajte `.env` fajl i unesite svoj `GOOGLE_API_KEY`.
3. Pokrenite glavnu skriptu:
   `py main.py`

## Korišćene tehnologije
- **Jezik:** Python 3.13
- **Framework:** LangChain (LCEL) [13, 18]
- **LLM:** Google Gemini 1.5 Flash [11]
- **Podaci:** Pandas (za rad sa backlog-om)

## Ograničenja i Rizici
- Agent zavisi od dostupnosti Google Gemini API-ja (Rizik R06) [16].
- Analiza je ograničena na kvalitet ulaznih podataka (opisa zadataka u JIRA-i) [6, 19].
B. requirements.txt (Biblioteke)