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
  dashboard/          → vista cross-cliente: KPI globali + card per cliente con trend keyword crescita/calo
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
- Colonna "Volume": `search_volume` popolato tramite bottone "Aggiorna volumi" (bulk manuale) o import CSV; NON più aggiornato automaticamente al salvataggio keyword singola.
- Ordinamento `filteredMonKw`: keyword con position asc → keyword senza position ordinate per `search_volume` desc → alfabetico.
- Empty state Monitoraggio: visibile solo se `keyword_history.length === 0`.

### 11. Tipo Dashboard

```typescript
type DashboardClient = {
  id: string;
  name: string;
  sector?: string;
  total_keywords: number;
  keywords_crescita: number;  // keyword con position < position_prev
  keywords_calo: number;      // keyword con position > position_prev
  last_sync: string | null;   // ISO timestamp più recente tra i gsc_updated_at
};
```

Pagina `app/dashboard/page.tsx`:
- Fetch `GET /api/dashboard` al mount via `apiFetch`
- 3 KPI card globali: Progetti attivi, Keyword in crescita (verde), Keyword in calo (rosso)
- Griglia card clienti `grid-cols-3` desktop / `grid-cols-1` mobile — cliccabili → `/clients/{id}`
- `TrendPill`: pill verde (↑ crescita) o rosso (↓ calo); hidden se value === 0
- `SyncBadge`: testo colorato — verde ≤7gg, grigio ≤14gg, arancione >14gg
- Skeleton loader (`animate-pulse`) con 6 card durante loading
- Empty state se array vuoto
- Componenti `TrendPill`, `SyncBadge`, `SkeletonGrid` definiti in fondo alla pagina (non file separati)
- Sidebar: voce "Dashboard" con icona `LayoutDashboard` — prima voce del menu

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
  published_url?                             // URL pagina pubblicata (migration 008)
  page_position?, page_clicks?,             // rendimento GSC della pagina come URL
  page_impressions?, page_ctr?,             //   (distinto dai campi query-level sopra)
  page_updated_at?                          //   aggiornato dal gsc-sync
}

type PositionSnapshot = {
  position: number; clicks: number; impressions: number; ctr: number; recorded_at: string;
};

type VisibilitySnapshot = {
  recorded_at: string; avg_position: number; total_clicks: number; total_impressions: number;
};
```

### 14. Campo URL pubblicato nel pannello KeywordRow
- Input `type="url"` con `onBlur` → chiama `onUpdate({ published_url: val ?? "" })`
- Salva stringa vuota per cancellare (il backend tratta "" come null)
- Link cliccabile `target="_blank"` mostrato sotto l'input se `published_url` è configurato
- Sezione "Rendimento pagina (GSC)" mostra `page_position/clicks/impressions/ctr/page_updated_at`
  se `published_url` è configurato — placeholder se `page_position == null`
- Indicatore 🔗 nella riga principale (non expanded) se `published_url` è configurato
- `onUpdate` e `updateKeyword`: `published_url` incluso nel Pick<KW, ...>

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

### 13. Import CSV keyword — formato e parser (app/clients/[id]/page.tsx)

Formato CSV supportato:
- Prima colonna obbligatoria: `keyword` (o `query`, `parola chiave`, `kw`)
- Colonne opzionali: `cluster`, `intent`, `priority`
- Intestazione auto-rilevata: se `firstCells[0]` è in `HEADER_KEYWORDS` → `hasHeader = true`
- Senza intestazione: tutte le righe trattate come keyword (solo colonna 0)

`colIndex` mappa le colonne dall'intestazione (`-1` = assente):
```typescript
const colIndex = { keyword: 0, cluster: -1, intent: -1, priority: -1 };
```

Ogni riga produce `{ keyword, cluster, intent, priority }` — stringhe vuote se colonna assente.
Il backend valida i valori di `intent` e `priority` e ignora quelli non validi.

Funzione `downloadTemplate()`: genera e scarica `template_keyword.csv` con 4 righe di esempio
(una per ogni valore di intent) — nessuna chiamata API.

Bottone "Scarica template": testo underline accanto a "Importa CSV".
Hint formato: paragrafo `text-[11px] text-[#c0c0c0]` sempre visibile sotto la toolbar,
con link inline "Scarica il template di esempio".

### 12. Bottone "Aggiorna volumi" (app/clients/[id]/page.tsx)

Stato aggiunto:
```typescript
const [refreshingVolumes, setRefreshingVolumes] = useState(false);
const [volumeRefreshResult, setVolumeRefreshResult] = useState<{
  skipped: boolean;
  next_refresh?: string;
  updated?: number;
} | null>(null);
```

- Bottone nella toolbar della tab Keyword, accanto a "Importa CSV"
- Chiama `POST /api/clients/{id}/keywords/refresh-volumes` via `apiFetch`
- Se `data.skipped === true`: Alert warn con data prossimo aggiornamento
- Se `data.skipped === false`: Alert info con N keyword aggiornate + `load()` per ricaricare
- Throttle 30 giorni gestito lato backend su `clients.volume_refreshed_at`

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
