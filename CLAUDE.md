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
  migration/          → mapping redirect 301 tra sito vecchio e nuovo (CSV Screaming Frog + GPT-4o)
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
- `useMemo` per: `kwWithGsc`, `filteredMonKw`, `monKpi`, `cannibSet`.
- Colonna Delta: confronta `position` vs `position_prev` (scritto dal backend nel GSC sync).
- `position_prev` è null finché non avviene un secondo sync GSC — in quel caso il badge mostra "—".
- KPI e filtro "Opportunità": `impressions > 100 AND position > 10 AND status === 'backlog'`.
- Colonna "Cannibalizzazione" ancora presente in tabella (usa `cannibSet` da `detectCannibalization`).
- Colonna "Volume": `search_volume` scritto automaticamente dal backend via DataForSEO al salvataggio keyword.
- Ordinamento `filteredMonKw`: keyword con position asc → keyword senza position ordinate per `search_volume` desc → alfabetico.
- Empty state Monitoraggio: visibile solo se `keyword_history.length === 0`.

### 10. Tipi Migrazione

```typescript
type NewDomain = {
  id: string;        // crypto.randomUUID()
  domain: string;    // es. "https://www.nuovo.it"
  label: string;     // es. "Italia" (opzionale, solo display)
  csv_file: File | null;
};

type LanguageRule = {
  id: string;
  pattern: string;                   // es. "/en/" o "vecchio.com"
  pattern_type: "subdirectory" | "domain";
  target_domain_id: string;          // id di un NewDomain
  behavior: "redirect" | "eliminated" | "consolidated";
  consolidated_target_domain_id?: string;
};

type MigrationResult = {
  old_url: string; old_title: string; old_h1: string; old_inlinks: number;
  new_url: string | null; new_title: string | null;
  target_domain: string | null;   // dominio di destinazione
  target_label: string | null;    // label opzionale del dominio
  confidence: number;
  match_type: "exact" | "slug" | "gpt" | "no_match" | "eliminated" | "consolidated";
  reason: string | null;
};

type MigrationStats = {
  total: number; matched: number; no_match: number; eliminated: number;
  stats: { exact: number; slug: number; gpt: number; no_match: number; eliminated: number; consolidated: number };
};
```

Pagina `app/migration/page.tsx`:
- Layout a due colonne (SITO VECCHIO | SITO NUOVO) in Step 1 "config"
- SITO VECCHIO: input dominio + upload CSV unico (drag & drop)
- SITO NUOVO: N card `NewDomain` (add/remove dinamico) — ognuna con dominio, label opzionale, upload CSV
- Accordion collassabile "Regole di instradamento" con N card `LanguageRule` (pattern, tipo, dominio target, comportamento)
  - `behavior=eliminated`: nessun redirect, match_type="eliminated"
  - `behavior=consolidated`: Select per dominio target di consolidamento
- Step 2 "loading": progress steps animati durante analisi
- Step 3 "results": KPI card + filtro dominio (se più domini) + tabella + export CSV
  - Colonna "Dominio" visibile solo se `uniqueTargetDomains.length > 1`
  - Filtro dominio dinamico sopra la tabella
- Badge `MatchTypeBadge`: "eliminated" (rosso scuro), "consolidated" (arancione)
- Usa `apiFetch` con `body: FormData` e `config` JSON per `/api/migration/analyze`
- Config inviato: `{ old_domain, new_domains: [{id, domain, label}], language_rules: [{pattern, pattern_type, target_domain_id, behavior, ...}] }`
- File: `old_csv` + `new_csv_{domain_id}` per ogni NewDomain
- Export via `POST /api/migration/export-csv` — download blob CSV

### 7. Tipo KW — campi completi
```typescript
type KW = {
  id, keyword, status, created_at
  impressions?, clicks?, position?, ctr?, gsc_updated_at?
  position_prev?, position_updated_at?       // GSC sync historicization
  cluster?, intent?, priority?
  search_volume?, volume_updated_at?         // DataForSEO (migration 005)
}

type PositionSnapshot = {
  position: number; clicks: number; impressions: number; ctr: number; recorded_at: string;
};

type VisibilitySnapshot = {
  recorded_at: string; avg_position: number; total_clicks: number; total_impressions: number;
};
```

### 9. Storico posizioni — pattern fetch lazy
- `KeywordRow`: al primo expand chiama `GET /api/clients/{id}/keywords/{kw_id}/history`
  - Flag `historyLoaded` evita re-fetch multipli
  - Se `history.length < 2` → messaggio "Dati insufficienti"
  - Se `history.length >= 2` → `ResponsiveContainer + LineChart` recharts (asse Y reversed)
- `ClientPage` (tab Monitoraggio): `useEffect([activeTab, clientId])` chiama `GET /api/clients/{id}/visibility-history`
  - Stato `visibilityHistory: VisibilitySnapshot[]` — vuoto finché non caricato
  - Sezione "Andamento progetto" visibile solo se `visibilityHistory.length >= 2`
  - Grafico aggregato (avg_position asse sx, total_clicks asse dx) + tabella confronto Oggi/-30/-60/-90gg
- recharts: importato da `"recharts"` — già disponibile nel progetto, nessuna installazione extra

### 8. Form cliente — campi DataForSEO
`language_code` (string, default "it") e `location_code` (number, default 2380) presenti in:
- `NewClientForm` + `EMPTY` in `app/clients/page.tsx`
- `ClientFull` (→ `EditForm` via Omit) in `app/clients/[id]/page.tsx`
Renderizzati come Input testo + Select con LOCATION_OPTIONS prima della sezione GSC.

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
