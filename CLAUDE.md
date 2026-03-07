# Lumi SEO Suite — Frontend

## Cos'è
Frontend Next.js per il tool SEO interno di Lumi Company.
Utente primario: HEAD of SEO (Alessandro). Non è un SaaS pubblico.

## Stack
- Next.js 16 App Router + React 19 + TypeScript strict
- TailwindCSS 4 (no component library esterna — design system interno)
- Supabase SSR auth (middleware + server/client split)
- lucide-react per icone
- Deploy: Vercel

## Struttura del progetto

```
app/
  login/              → unica pagina SENZA AppShell (nessun guard auth)
  clients/            → lista clienti (form nuovo cliente con gsc_property)
  clients/[id]/       → pagina principale con due tab:
                          "Keyword" — keyword management, GSC sync, briefs
                          "Monitoraggio" — tabella GSC con delta posizione, KPI card, filtri rapidi
  seo/                → analisi SEO tool (SERP + competitor + brief GPT-4o)
  writer/             → generazione articoli da brief
  impostazioni/       → gestione API keys (OpenAI, SerpAPI) + logout
components/
  AppShell.tsx        → layout con Sidebar + guard auth (wrappa TUTTE le pagine tranne /login)
  ui.tsx              → design system interno: PageHeader, Card, Input, Btn, Alert, Badge, ecc.
lib/
  api.ts              → wrapper apiFetch — usa SEMPRE questo per chiamate al backend
utils/supabase/
  client.ts           → Supabase client lato browser
  server.ts           → Supabase client lato SSR
middleware.ts         → redirect a /login se sessione assente
```

## Pattern critici — NON bypassare

### 1. apiFetch (lib/api.ts)
Wrapper su `fetch` che inietta automaticamente:
- `Authorization: Bearer <jwt>` — token Supabase
- `X-OpenAI-Key` — da `localStorage.getItem("lumi_openai_key")`
- `X-SerpAPI-Key` — da `localStorage.getItem("lumi_serpapi_key")`

**Non usare `fetch()` diretto per chiamate al backend.**
Comportamento speciale: su risposta 401 esegue logout + redirect a /login.

### 2. API keys in localStorage
Chiavi salvate con queste chiavi esatte:
```
lumi_openai_key   → header X-OpenAI-Key
lumi_serpapi_key  → header X-SerpAPI-Key
```
Gestite in `app/impostazioni/`. Vedi `docs/adr/001-api-keys-via-header.md`.

### 3. Auth a due livelli
1. **Middleware** (`middleware.ts`): redirect a /login lato server se sessione assente
2. **AppShell** (`components/AppShell.tsx`): verifica sessione lato client (secondo layer)
Token JWT Supabase — refresh automatico gestito da `apiFetch`.

### 4. detectCannibalization() — algoritmo (app/clients/[id]/page.tsx)
Funzione client-side pura (nessuna chiamata API).

**Logica:**
1. Raggruppa keyword per `intent` (solo keyword con intent assegnato)
2. Per ogni coppia nello stesso gruppo, estrae i token di ogni keyword:
   - Minuscolo, split su spazi, filtra token con `length > 2` E non in `STOP`
3. Conta overlap tra i due set di token
4. Se `overlap >= 2` → segnala cannibalizzazione

**STOP words:** italiano + inglese essenziali (es. di, il, la, the, for, best...)

Vedi `docs/adr/003-cannibalization-client-side.md` per la scelta architetturale.

### 5. Keyword status pipeline
```
backlog → planned → brief_done → written → published
```
I colori/label per ogni status sono definiti in `STATUS_CFG` all'inizio di `clients/[id]/page.tsx`.

### 6. Tab Monitoraggio — pattern dati
- Usa gli stessi dati keyword già caricati nella pagina (nessuna chiamata API separata).
- `useMemo` per: `kwWithGsc`, `monitoraggioKw`, `monKpi`, `cannibSet`.
- Colonna Delta: confronta `position` vs `position_prev` (scritto dal backend nel GSC sync).
- `position_prev` è null finché non avviene un secondo sync GSC — in quel caso il badge mostra "—".

## Convenzioni

- Componenti UI condivisi → `components/ui.tsx` (non creare nuovi file per elementi base)
- Stato pagina: `useState` locale (no Redux, no Zustand — complessità non giustificata ora)
- TypeScript strict attivo — no `any` senza commento che spiega il motivo
- `useMemo` per calcoli derivati da lista keyword (filtraggio, groupby, cannibalization)

## Variabili d'ambiente necessarie

```
NEXT_PUBLIC_API_BASE_URL   → URL backend FastAPI (Render)
NEXT_PUBLIC_SUPABASE_URL   → URL progetto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY → anon key Supabase
```

## Workflow "prompt-safe"

Ad ogni sessione, se viene modificata una decisione architetturale:
1. Aggiorna o crea il file ADR corrispondente in `docs/adr/` del repo backend
2. Se cambia logica non banale (es. `detectCannibalization`), aggiungi/aggiorna il test
3. Aggiorna questo file se cambiano stack, struttura o pattern
