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
  page.tsx            → homepage (tool card 01–05, workflow consigliato)
  login/              → unica pagina SENZA AppShell (nessun guard auth)
  clients/            → lista clienti con KPI globali + trend keyword + form nuovo cliente
  calendar/           → calendario editoriale: keyword pianificate per mese (vista mensile + lista)
  clients/[id]/       → pagina principale con due tab:
                          "Keyword" — keyword management, GSC sync, briefs
                          "Monitoraggio" — tabella GSC con delta posizione, KPI card, filtri rapidi
  seo/                → analisi SEO tool (SERP + competitor + brief GPT-4o)
  migration/          → mapping redirect 301 tra sito vecchio e nuovo (CSV Screaming Frog + GPT-4o)
  writer/             → generazione articoli da brief
  impostazioni/       → gestione API keys (OpenAI, SerpAPI) + logout
components/
  AppShell.tsx        → layout con Sidebar + guard auth (wrappa TUTTE le pagine tranne /login)
  Sidebar.tsx         → sidebar navigazione con UserAvatar, nav ordinata, ActiveClient, Settings/Esci
  ui.tsx              → design system interno: PageHeader, Card, Input, Btn, Alert, Badge, ecc.
lib/
  api.ts              → wrapper apiFetch — usa SEMPRE questo per chiamate al backend
utils/supabase/
  client.ts           → Supabase client lato browser
  server.ts           → Supabase client lato SSR
middleware.ts         → redirect a /login se sessione assente
```

### Homepage (app/page.tsx)
- 5 `ToolCard` con numero, titolo, descrizione, href e icona lucide
- Ordine: Clienti & Dashboard, Calendario, Analisi SEO, Redattore, Migrazione
- Componente `ToolCard` definito in fondo alla pagina (non file separato)
- Icone da `ICONS = { Users, Calendar, BarChart2, PenLine, ArrowLeftRight }`
- Layout: header bianco + scrollable area `bg-[#f7f7f6]`, `max-w-2xl`

### Sidebar (components/Sidebar.tsx)
Ordine nav esatto:
1. Clienti → /clients — `Users`
2. Calendario → /calendar — `Calendar`
3. Analisi SEO → /seo — `BarChart2`
4. Brief → /briefs — `FileText`
5. Redattore → /writer — `PenLine`
6. Articoli → /articles — `BookOpen`
7. Migrazione → /migration — `ArrowLeftRight`
8. Archivio redirect → /migrations — `Archive`

Sezione "Admin" (visibile solo per admin):
9. Amministrazione → /admin — `ShieldCheck`

In fondo (separati da border-t):
- Impostazioni → /impostazioni — `Settings`
- Esci — `LogOut`

Componenti definiti in fondo a `Sidebar.tsx`:
- `UserAvatar`: avatar initials utente Supabase + "Lumi SEO Suite" — in cima, sopra nav
- `ActiveClient`: fetch nome cliente da `/api/clients/{id}` se pathname `/clients/[id]` — sopra il divider Settings/Esci; fire-and-forget, nessun loading state visibile

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

### 11. Tipo Client (app/clients/page.tsx)

```typescript
type Client = {
  id: string;
  name: string;
  sector?: string;
  tone_of_voice?: string;
  total_keywords: number;
  keywords_crescita: number;  // keyword con position < position_prev
  keywords_calo: number;      // keyword con position > position_prev
  last_sync: string | null;   // ISO timestamp più recente tra i gsc_updated_at
};
```

Pagina `app/clients/page.tsx`:
- Fetch `GET /api/dashboard` al mount via `apiFetch` (restituisce trend + metriche GSC per ogni cliente)
- `GlobalKpi`: 3 KPI card globali (Progetti attivi, Keyword in crescita verde, Keyword in calo rosso)
  — visibile solo quando `!loading && clients.length > 0`
- Card cliente: sinistra (nome + sector/tone), centro (GSC metrics se `clicks_curr > 0`, altrimenti fallback keyword count), destra (SyncBadge + →)
  - Centro con GSC: click + trend%, impressioni + trend%, pos. media, pill ↑↓ keyword
  - Centro senza GSC: conteggio keyword o "Nessuna keyword"
- Skeleton loader (`animate-pulse`) con 3 card `h-[72px]` durante loading
- Empty state se array vuoto
- Form "Nuovo cliente" → POST `/api/clients` (invariato)
- Componenti `SyncBadge`, `GlobalKpi`, `KpiCard`, `TrendPct` definiti in fondo alla pagina

### Tipo ClientSummary (app/clients/[id]/page.tsx)

```typescript
type ClientSummary = {
  total_clicks: number;
  total_impressions: number;
  avg_position: number | null;
  avg_ctr: number | null;
  top_clicks: Array<{ keyword: string; clicks: number; impressions: number; position: number }>;
  top_impressions: Array<{ keyword: string; clicks: number; impressions: number; position: number }>;
};
```

Pagina `app/clients/[id]/page.tsx`:
- `summary` stato caricato in parallelo al cliente (`Promise.all`) via `GET /api/clients/{id}/summary`
- Se `sumRes.ok`, il summary viene settato; se fallisce, rimane `null` (silenzioso)
- Sezione "Summary GSC" visibile sopra la KPI bar se `summary && summary.total_clicks > 0`:
  - 4 KPI card: Click (28gg), Impressioni (28gg), Posizione media, CTR medio
  - 2 card affiancate: Top 5 per click | Top 5 per impressioni
- Componente `SummaryKpi` definito in fondo alla pagina

### 18. Pagina Articoli (app/articles/page.tsx)

```typescript
type Article = {
  id: string;
  keyword: string;
  market: string;
  intent: string | null;
  created_at: string;
  client_id: string | null;
  article_output: string;
};
```

- Fetch `GET /api/writer/articles` al mount
- Filtro ricerca locale per keyword via `useMemo`
- Una sola riga espandibile alla volta
- **ArticleRow** (componente in fondo alla pagina):
  - Bottoni in ordine: "Esporta .docx" / "Modifica" / "Elimina"
  - Textarea font-mono 24 righe per editing
  - Conferma eliminazione inline: "L'articolo verrà rimosso (il brief resterà disponibile)."
- `PATCH /api/writer/articles/{id}` — aggiorna lista locale
- `DELETE /api/writer/articles/{id}` — azzera article_output, rimuove riga localmente
- Export `.docx` lato client via `docx` npm + `file-saver`: nome file `{keyword}-articolo.docx`

### Export .docx — funzioni condivise (briefs e articles)

Helpers `parseInlineMarkdown` e `parseMarkdownToDocx` definiti in ogni pagina (no file separato).
- `parseInlineMarkdown(text)`: gestisce `**bold**` inline → `TextRun[]`
- `parseMarkdownToDocx(markdown)`: converte `# H1`, `## H2`, `### H3`, `- bullet`, paragrafi normali → `{ children: Paragraph[], numbering }`
- `handleExportDocx(article)` in `/articles`: nome `{keyword}-articolo.docx`
- `handleExportBriefDocx(brief)` in `/briefs`: nome `{keyword}-brief.docx`
- Font Arial 24pt body, 32/28/26pt per H1/H2/H3; margini A4 (1440 twips)

### 17. Pagina Brief (app/briefs/page.tsx)

```typescript
type Brief = {
  id: string;
  keyword: string;
  market: string;
  intent: string | null;
  created_at: string;
  client_id: string | null;
  brief_output: string;
};
```

- Fetch `GET /api/seo/briefs` al mount → tutti i campi incluso `brief_output`
- Filtro ricerca locale per keyword (no API call) tramite `useMemo`
- Una sola riga espandibile alla volta (`expandedId: string | null`)
- Stato per ogni riga gestito con mappe indicizzate per id: `editTexts`, `rowError`
- **BriefRow** (componente definito in fondo alla pagina):
  - Stato collassato: keyword · market · intent · data + bottoni "Esporta .docx" / "Modifica" / "Elimina"
  - Stato modifica: textarea font-mono 20 righe + "Salva modifiche" / "Annulla"
  - Stato elimina: conferma inline "Sei sicuro? Questa azione è irreversibile." + "Sì, elimina" / "Annulla"
  - Feedback "✓ Salvato" in verde per 2s dopo salvataggio (via `savedId` + `setTimeout`)
  - `Alert type="error"` inline nella riga in caso di errore
- Salvataggio: `PATCH /api/seo/briefs/{id}` — aggiorna lista locale senza refetch
- Eliminazione: `DELETE /api/seo/briefs/{id}` — rimuove riga localmente senza refetch
- Export `.docx` lato client: `handleExportBriefDocx(brief)` → nome `{keyword}-brief.docx`
- Empty state: messaggio diverso se ricerca attiva vs lista vuota
- Skeleton loader (3 righe `h-12 animate-pulse`) durante caricamento iniziale

### 16. Redattore articoli (app/writer/page.tsx)

```typescript
type Brief = {
  id: string;
  keyword: string;
  market: string;
  created_at: string;
  client_id: string | null;
};

type ClientOption = {
  id: string;
  name: string;
};
```

- `useEffect` carica briefs e clienti in parallelo con `Promise.all`:
  - `GET /api/seo/briefs` → `setBriefs`
  - `GET /api/writer/clients` → `setClients`
- **Selettore cliente** (primo nel form): popola `clientId` state; se selezionato, mostra badge verde "✓ Tone of voice e note del cliente verranno applicati"
- **Selettore brief**: se il brief ha `client_id` e il selettore cliente è ancora vuoto, pre-compila `clientId` automaticamente — non sovrascrive scelta già fatta dall'utente
- POST body include `client_id: clientId || null`
- Graceful degradation: se nessun cliente selezionato, il redattore funziona come prima

### 19. Pagina Migrazioni archiviate (app/migrations/page.tsx)

```typescript
type MigrationRecord = {
  id: string;
  name: string;
  old_domain: string;
  new_domains: Array<{ domain: string; label?: string }>;
  total_urls: number;
  matched_urls: number;
  created_at: string;
};
```

- Fetch `GET /api/migrations` al mount
- Lista `MigrationRow` per ogni record (in `Card` con `divide-y`)
- **MigrationRow**: nome · dominio vecchio · data | matched/total + % | Riesporta CSV | Elimina
- **Riesporta CSV**: `GET /api/migrations/{id}` → `POST /api/migration/export-csv` con `{ results: full.results, old_domain: full.old_domain }`; download blob CSV
- **Elimina**: conferma inline "Eliminare definitivamente?" + `DELETE /api/migrations/{id}` + rimozione locale
- Skeleton loader 3 righe durante caricamento
- Empty state: "Nessuna migrazione archiviata."

### Salvataggio automatico migrazione (app/migration/page.tsx)

Dopo aver ricevuto i risultati dall'analisi (`setStep("results")`), chiama automaticamente:
```typescript
saveMigration(data.results, statsData)
```
- `saveMigration` è silenzioso: non blocca l'utente in caso di errore
- Mostra badge discreto nei controlli risultati: "Salvataggio…" / "✓ Archiviata"
- `savedMigrationId` e `saving` stati aggiunti alla pagina
- Salva risultati semplificati: `{ old_url, new_url, match_type, confidence }`
- Usa `POST /api/migrations`

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
  match_type: "exact" | "slug" | "gpt" | "no_match" | "eliminated" | "consolidated" | "homepage";
  reason: string | null;
};

type MigrationStats = {
  total: number; matched: number; no_match: number; eliminated: number; homepage: number;
  stats: { exact: number; slug: number; gpt: number; no_match: number; eliminated: number; consolidated: number; homepage: number };
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

### 15. Calendario editoriale (app/calendar/page.tsx)

```typescript
type CalendarKeyword = {
  id: string; keyword: string; status: string; planned_month: string; client_id: string;
  cluster?: string; intent?: string; priority?: string;
  clients: { id: string; name: string };  // join Supabase
};
```

- Fetch `GET /api/clients/calendar` al mount via `apiFetch`
- Due viste: "Mensile" (default) e "Lista" — toggle in header
- Vista mensile:
  - Navigazione mese con `ChevronLeft`/`ChevronRight`
  - Sezione "N keyword pianificate" con `KeywordPill` raggruppati per cliente
  - Griglia 7 colonne (Lun→Dom) con i giorni del mese corrente
  - 6 `MonthDropZone` (mese corrente + 5 successivi) per drag & drop
- Vista lista: tabella keyword ordinate per `planned_month` asc, poi cliente; raggruppate per mese con separatore visivo
- `KeywordPill`: `draggable`, colore da `STATUS_CFG`, link a `/clients/{id}`
- `MonthDropZone`: drop target HTML5 nativo — nessuna libreria esterna
- `handleDrop`: aggiornamento ottimistico + `PATCH /api/clients/{client_id}/keywords/{id}` con `{ planned_month: "YYYY-MM" }`
- `STATUS_CFG` replicato localmente (stessi valori di `clients/[id]/page.tsx`)
- Sidebar: voce "Calendario" con icona `Calendar` — seconda voce dopo "Dashboard"

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

## Design System (Task 9 — redesign SaaS)

### CSS custom properties (`app/globals.css`)
```css
--lumi-purple: #6366f1
--lumi-purple-dark: #4f46e5
--lumi-purple-muted: rgba(99,102,241,0.18)
--lumi-sidebar-bg: #0f1117
--lumi-sidebar-border: rgba(255,255,255,0.07)
```

### Sidebar scura (`components/Sidebar.tsx`)
- Background `var(--lumi-sidebar-bg)` (`#0f1117`), bordi `var(--lumi-sidebar-border)`
- `NAV_GROUPS`: 3 sezioni — Principale (Clienti, Calendario), Contenuti (SEO, Brief, Redattore, Articoli), Strumenti (Migrazione, Archivio redirect)
- Label sezione: `fontSize: 9.5, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)"`
- Item attivo: `background: "rgba(99,102,241,0.18)"`, `color: "#a5b4fc"`, `fontWeight: 500`
- Hover via `onMouseEnter`/`onMouseLeave` inline (Tailwind non gestisce hover su dark bg con condizionale runtime)
- `UserAvatar`: logo gradiente L-path + "Lumi SEO" + initials badge (right-aligned)
- Footer: Impostazioni link + Esci button con hover rosso via inline handlers

### Badge semantici (`components/ui.tsx`)
`<Badge variant="...">` — varianti: `default | blue | green | amber | red | purple`
```typescript
default: "bg-[#f4f4f3] text-[#555] border-[#e8e8e8]"
blue:    "bg-[#e0e7ff] text-[#4338ca] border-[#c7d2fe]"
green:   "bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]"
amber:   "bg-[#fef9c3] text-[#a16207] border-[#fef08a]"
red:     "bg-[#fee2e2] text-[#b91c1c] border-[#fecaca]"
purple:  "bg-[#ede9fe] text-[#6d28d9] border-[#ddd6fe]"
```

### STATUS_CFG — tipo aggiornato
`Record<string, { label: string; color: string }>` — il campo `color` è una stringa Tailwind
(es. `"bg-[#dcfce7] text-[#15803d] border-[#bbf7d0]"`).
**Non** più 3 campi separati `color/bg/border` come inline styles.
Usato con `className={... + " " + cfg.color}` — mai `style={{}}`.
Definito in `clients/[id]/page.tsx` e replicato in `calendar/page.tsx`.

### Tabelle dense
Classe `.table-dense` in `globals.css` per tabelle compatte (th/td padding ridotto, font 12px).

### Favicon
`public/favicon.svg` — rettangolo viola `#6366f1` rx=8 con L-path bianca (logo Lumi).
Referenziato in `app/layout.tsx` via `metadata.icons.icon`.

### 20. Sistema multi-utente

#### Hook `useCurrentUser` (hooks/useCurrentUser.ts)
```typescript
type UserProfile = { id: string; email: string; role: "admin" | "specialist"; full_name: string };
function useCurrentUser(): { user: UserProfile | null; loading: boolean; isAdmin: boolean }
```
- Chiama `GET /api/auth/me` al mount
- Usato da `Sidebar.tsx` per mostrare link Admin e da `app/admin/page.tsx`

#### Sidebar — link Admin
- Importa `ShieldCheck` da lucide-react e `useCurrentUser` dal hook
- Sezione "Admin" con `NavLink` verso `/admin` — visibile solo se `isAdmin === true`
- `NavLink` estratto come componente locale per riuso

#### Pagina Admin (app/admin/page.tsx)
- Accesso negato con `Alert type="error"` se `!isAdmin`
- Due tab: **Utenti** e **Assegnazioni**
- **Tab Utenti**:
  - Form nuovo utente: email, password, nome, ruolo → `POST /api/admin/users`
  - Lista utenti: nome/email · data · badge ruolo · toggle ruolo · elimina
  - Toggle ruolo: `PATCH /api/admin/users/{id}` con `{ role: newRole }`
  - Elimina: conferma inline → `DELETE /api/admin/users/{id}`
- **Tab Assegnazioni**:
  - Lista clienti con owner e `<select>` per assegnare specialist
  - `PATCH /api/admin/clients/{id}/assign` con `{ assigned_to: userId | null }`
  - Aggiornamento ottimistico della lista locale

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
