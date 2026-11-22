# Critter Swap
 
A free, static trading board for **Clash of Critters** cards (Autumn Tales album: 135 cards, each in normal and foil). Players list the cards they have spare and the cards they're looking for, and the page shows who can trade with whom.
 
- **Front end:** `index.html` plus two small scripts, `logic.js` and `config.js` (plain HTML/JS, no build step), hosted on GitHub Pages.
- **Database:** a public Google Sheet.
- **Writes:** a small Google Apps Script web app (`Code.gs`) attached to that sheet.
```
 Browser (index.html on GitHub Pages)
    |  read:  Apps Script ?action=grid   (live, includes the gold-trading switch)
    |         or Google gviz endpoint (fallback)
    |  write: POST to Apps Script  --->  Code.gs  --->  Google Sheet
```
 
## How it works
 
### The sheet
 
The album tab is named `Latest-Album` and is a grid with **one column per player**:
 
| | B | C | D |
|---|---|---|---|
| **1** `USERNAME` | Alice | Bob | ... |
| **2** `PUID` | 1001 | 2002 | ... |
| **3-137** cards `1`..`135` | `FT` | `LF` | |
| **138-272** foils `1F`..`135F` | | `FT` | |
 
- `FT` = **F**or **T**rade (a spare the player can give away). `FT3` means three spare copies (`FT` alone is one).
- `LF` = **L**ooking **F**or (a card the player needs).
- Blank = neither. Copy counts only apply to `FT`; `LF` is always one.
- A player is identified by **user name (row 1) + player ID / PUID (row 2)**. Both must match.
- Keep row 2 formatted as **Plain text**, or Google may turn IDs into numbers and the page can't read them.
- Do not reorder or delete card rows; the app finds cards by row position.
Two helper tabs are created automatically:
 
- `Settings` (`key | value`): `goldTrading` = `on`/`off`, and `scriptUrl` (filled in for you).
- `Cards` (`number | name | stars | rarity`): optional overrides for card names, stars and rarity. A blank cell keeps the page's built-in default.
### Card codes
 
`12` is normal card 12; `12F` is the foil version. Lists are typed as comma-separated values, e.g. `3, 12F, 40`. `#40` and `[...]` wrappers are also accepted.
 
**Multiple copies.** In *For trade*, add `x` and a number for duplicates: `22x3` is three copies of card 22 and `90Fx2` is two foil copies (`22*3` and `22×3` also work, up to 99). Normal and foil are counted separately. In the sheet this is stored as `FT3`. *Looking for* ignores counts.
 
Gold cards (63, 72, 80, 90, 96, 98, 106, 108, 113, 114, 117, 121, 123, 125, 131, 134, 135) can only be traded during the game's gold trading windows. Set `goldTrading` to `on` in the `Settings` tab while a window is open.
 
### The page
 
The page is `index.html` plus `logic.js` and `config.js`; keep them in the same folder.
 
1. **Connect.** If the site has a default sheet (see *Default sheet* below), it connects straight away. Otherwise, on first visit, paste the Google Sheet *Share* link (the `.../spreadsheets/d/<ID>/edit...` form) and press Submit. The ID is remembered in a cookie (with a localStorage fallback), so later visits skip this step. "Publish to web" links (`/d/e/2PACX-...`) don't work; use the Share link, with access set to "Anyone with the link: Viewer".
2. **My Lists tab (default).** Enter your user name and player ID (also remembered). *Load my lists* finds the column matching both and fills **For trade** and **Looking for**. Edit them as arrays (use `22x3` for copies in For trade), then *Save to sheet* overwrites that column. The chips under each box show copies as `#22 ×3`.
3. **Cards tab.** The same list editor and Save button, plus a card picker: 9 cards per row (one set per row), cards already in your lists preselected, and star count shown on each card. Filters for **Sets**, **Rarity** and **Stars** are multi-select; the default is all sets, normal + gold, and 4★ + 5★. Stars follow the New Journey album, by card number. Selections hidden by a filter are counted in a hint so you don't lose track of them. A selected card gets a thick accent-colored border. In **For trade** mode a selected card also shows its copies on the button (`Normal ×3`) and a **− / +** stepper under it; going below 1 un-selects the card.
4. **Matches tab.** It has two halves. The first, **Cards you're looking for**, is below; the second, **Who wants your spare cards**, is described after it. Trades are **1 card for 1 card**, so for each other player P the page looks in both directions:
   - **You get** a card that is in your *Looking for* and in P's *For trade*.
   - **You give** a card that is in your *For trade* and in P's *Looking for*.
   Players where both directions work appear under **Even swaps**: the card you get on the left, then P's user name and player ID, a drop-down of the cards you can give them, and **Trade completed**. Players who have a card you want but want nothing you have appear under **They have it, but want nothing you have**, with no button (you could still ask them directly). Gold cards are left out of the give list while `goldTrading` is off, and a gold card you'd receive is disabled until it's on.
   Providers who hold several copies show `has ×3`, and the give drop-down shows `(you have ×2)`.
   **Trade completed** updates four cells: your `LF` is cleared and *one copy* comes off their `FT` on the card you get; their `LF` is cleared and *one copy* comes off your `FT` on the card you give. So `FT3` becomes `FT2` and that player can still trade the card; the last copy clears the cell. It refuses if you have unsaved changes, and the server re-checks all four cells first so a stale page can't wipe newer data.
   **Who wants your spare cards** is the other direction: for each card in your *For trade* list, it lists every player who has it in their *Looking for* (user name and player ID, plus how many players want it and how many copies you have). A player who also has a card you're looking for is tagged **Even swap: has #N**, meaning you can trade 1-for-1 (it also shows up in the first half, where the **Trade completed** button is). Players with nothing you want are listed too, so you can still offer them a swap. Cards nobody wants are summarized in one line, and gold cards are flagged while gold trading is closed.
5. **Theme.** The **Theme** menu (top right) switches between *Night Forest* (the default), *Autumn Tales*, *Berry Pop* and *Ocean Calm*. The choice is remembered in the visitor's cookie. The colors are the CSS variables at the top of `index.html`, one block per theme.
6. **Reload.** The **Reload** button does a full, cache-free reload of the page: it reopens the address with a new `?r=<timestamp>` so the browser (including Discord's built-in one) fetches `index.html`, `logic.js`, `config.js` and the sheet data fresh. It asks first if you have unsaved edits.
### Card stars, names and rarity
 
Star counts have a built-in default, the `STARS` string near the top of `index.html` (one digit per card number, nine per set, following the New Journey album; foil and normal share it). The sheet's `Cards` tab can override stars, names and rarity per card, and a blank cell keeps the default. To fix a star count for everyone without a code change, edit the `stars` cell in the `Cards` tab and have players press Reload.
 
### Reading data (and cache)
 
The page tries the Apps Script `?action=grid` endpoint first, since it is live and exact. It also returns the live `goldTrading` switch, so the "gold trading is closed/open" banner doesn't depend on Google's cached public copy of the `Settings` tab (which can lag a few minutes). If no script URL is set, it falls back to Google's public gviz endpoint:
 
```
https://docs.google.com/spreadsheets/d/<ID>/gviz/tq?tqx=out:json&headers=0&sheet=Latest-Album
```
 
Both requests are cache-busted (`&_=<timestamp>`, `cache: 'no-store'`). The gviz fallback has a quirk: a cell whose type differs from the rest of its column is returned blank. Column A mixes numbers and text, so A1 can read blank and numeric PUIDs can disappear. That's why row 2 should be plain text and why the page only rejects a sheet if A1 is non-empty and isn't `USERNAME`.
 
The page footer shows a build stamp and the last load time. GitHub Pages caches files for a few minutes, so after pushing a change, press **Reload** (or hard refresh with Ctrl+Shift+R). `logic.js` and `config.js` are always requested with a fresh `?v=` value. A visitor whose browser holds an old `index.html` that predates the new Reload button can open the site with `?r=1` on the end once.
 
### Writing data (`Code.gs`)
 
- `doGet`: `?action=grid` returns the album tab as text rows plus `gold` (the live `goldTrading` value); any other call runs setup (creates the album tab, seeds `Cards`, stores the `/exec` URL in `Settings`).
- `doPost` **save**: validates the player ID (`A-Z a-z 0-9 _ -`, up to 30 chars) and a user name; finds the column matching both name and PUID; refuses the same PUID under a different name; otherwise uses the first empty column. It rewrites rows 1-272 of that column with `LF`/`FT` (`FT` wins if a card is in both lists; copies are written as `FT3`) and sets the format to plain text. Tokens look like `12`, `12F` or `12x3`.
- `doPost` **complete** (`action: "complete"`, with `card` = card you get and `giveCard` = card you give): finds both players, refuses a self-trade, checks all four cells (my `LF`/their `FT` on the first card, my `FT`/their `LF` on the second), then clears the `LF` cells and takes one copy off each `FT` cell (`FT3` → `FT2`, `FT` → empty).
- A `website` field is a honeypot for spam bots, and a script lock serialises concurrent writes.
## Default sheet (so you don't share the link)
 
`config.js` holds a default sheet (`window.CRITTER_CONFIG = { sheet: '<link or ID>' }`). Visitors with no saved sheet use it automatically, and **Change sheet** still lets anyone switch to another one (the default is pre-filled, so reverting is one click). The default isn't stored in the visitor's cookie, so changing it later reaches everyone. A sheet the visitor picked themselves is remembered as before.
 
Two ways to set it:
 
- **Simple:** edit `config.js` and commit it.
- **GitHub variable:** in the repo go to *Settings > Secrets and variables > Actions > Variables* and add a repository variable `SHEET_URL`. Then set *Settings > Pages > Source* to **GitHub Actions**. The workflow in `.github/workflows/pages.yml` rewrites `config.js` from that variable on every deploy. To change the sheet, edit the variable and re-run the workflow.
This is a convenience, not a secret: a static site has to send the sheet link to every browser, and the sheet is public anyway. (Real GitHub Secrets can't be read by a page running in the browser.)
 
## Setup
 
1. **Sheet.** Create a Google Sheet, share it as "Anyone with the link: Viewer".
2. **Script.** Open *Extensions > Apps Script*, paste `Code.gs`, save.
3. **Deploy.** *Deploy > New deployment > Web app*; **Execute as: Me**, **Who has access: Anyone**.
4. **Initialise.** Open the web app URL (it ends in `/exec`, not `/dev`) once in your browser. This creates the tabs and saves the URL in `Settings`.
5. **Host.** Push `index.html` (and the `cards/` images) to GitHub and enable *Settings > Pages* on the branch. The site is at `https://<user>.github.io/<repo>/`.
6. Open the site, paste the sheet link, and you're in.
After changing `Code.gs`, use *Deploy > Manage deployments > Edit > New version*. Saving the script alone does not update the live web app. Until you do, saving copies like `22x3` is silently dropped and the live gold status isn't sent.
 
### Card images
 
`index.html` loads `cards/<number>.webp` (`cards/1.webp` ... `cards/135.webp`). Foils reuse the same image with a rainbow overlay. Missing images fall back to a placeholder.
 
## Troubleshooting
 
| Symptom | Cause / fix |
|---|---|
| **401** when saving | Deployment access isn't "Anyone", or the `/dev` URL is in use. Use the `/exec` URL and redeploy as a New version. |
| "Publish to web" link rejected | Use the Share link instead (`/d/<ID>/edit...`). |
| Lists don't prefill | User name **and** player ID must both match the sheet (case-insensitive). Check row 2 is plain text, then press *Load my lists*. |
| Old data or old page after an update | Press **Reload** (it bypasses the cache). GitHub Pages and browsers, especially Discord's in-app browser, cache aggressively. |
| "Gold trading is closed" is out of date | Redeploy `Code.gs` as a New version (the live value comes from the script), then press Reload. |
| Copies like `22x3` don't save | The old `Code.gs` is still deployed. Redeploy it as a New version. |
| "The sheet has changed..." on Trade completed | Someone edited the cells since you loaded. Press Reload and check. |
| Page won't save a player ID | Only letters, digits, `_` and `-` are allowed, up to 30 characters. |
 
## Known limitations
 
- **No passwords.** Anyone who knows a name + player ID can overwrite that column or clear its marks. The sheet is public, so treat it as a friendly community board, not secure storage.
- Card names are placeholders until filled in on the `Cards` tab.
- The Apps Script backend runs as the sheet owner and is subject to Google's quotas.
## Files
 
| File | Purpose |
|---|---|
| `index.html` | The web app: layout, tabs, themes, reading and saving. |
| `config.js` | Default sheet link (empty by default; the GitHub workflow can generate it from `SHEET_URL`). |
| `.github/workflows/pages.yml` | Optional deploy workflow that builds `config.js` from the `SHEET_URL` variable. |
| `logic.js` | Pure logic with no DOM or network: list parsing (including copies), sheet-grid parsing, `findMatches` (what you can get) and `findWanted` (who wants your spare cards) (the 1-for-1 matching). Loaded by `index.html`, and also usable from Node (`require('./logic.js')`). |
| `Code.gs` | Apps Script backend (save, complete trade, live grid and gold-switch read). |
| `cards/*.webp` | Card images named by card number. |
| `WoowooTradeSheet.xlsx` | Sample sheet layout (one populated column A). |
 
