# Claude Code mods — install guide

Nine mods for Claude Code, reviewed before install. **Nothing here was run or installed by me** (my cloud session has no
connection to your Mac). I read each repo's code and searched it for network calls, shell execution and file writes.
That is a read-through, not a security audit.

Reviewed commits: claude-kit `c871c15` · claude-skins `cf0d39f` · claude-code-filetree `1fdc3a9` · cache-tax `535ff33` ·
claude-code-playground `569c528` · claude-reflect `b6c4232` · terminal-browser `fa9e5eb`.
Installing from a marketplace pulls the latest version, which can be newer than what I read.

## Before you start

- Mods need **Claude Code 2.1.287 or newer**. Update first: `claude update` (or update the Claude desktop app).
- Run the commands below in **Terminal**. If `claude` is "command not found", type the same thing inside a Claude Code
  session as a slash command instead: `claude plugin install X` becomes `/plugin install X`.
- `--scope user` makes a mod available in every project you code in (not just one folder).
- Restart Claude Code after installing.
- Remove one with `claude plugin uninstall NAME@MARKETPLACE`.

## Install now (reviewed, nothing sent off your machine)

### 1. Filetree — file tree pane
```bash
claude plugin marketplace add data-goblin/claude-code-filetree
claude plugin install filetree@claude-code-filetree --scope user
```
Local only. No network or shell calls found.

### 2. Blast Radius — holds risky commands (Anthropic sample)
### 3. Replay Theater — step through Claude's last file edits (Anthropic sample)
Both live in Anthropic's `claude-code-playground` repo, which installs from a local folder:
```bash
git clone https://github.com/anthropics/claude-code-playground.git ~/claude-code-playground
cd ~/claude-code-playground/claude-code/mods
claude plugin marketplace add ./
claude plugin install blast-radius@claude-code-playground-mods --scope user
claude plugin install replay-theater@claude-code-playground-mods --scope user
```
No network calls found. Blast Radius holds `rm -rf`, `git reset --hard`, force pushes and migrations behind Proceed/Cancel
buttons, and runs a read-only dry run for `git clean`. That repo also has a third mod, `token-weather` (context-window forecast),
which you did not ask for.

### 4. Savvy Progress — progress bar + live agents panel
```bash
claude plugin marketplace add johnnyvizz/claude-kit
claude plugin install savvy-progress@claude-kit --scope user
```
No network calls found. Heads up: it adds two tools to your sessions (`mcp__savvy-progress__progress` and `__step`) and was
tested on Claude Code 2.1.286 using an early-access API that "may change between releases". It is built for the same author's
`savvy-flow` skill (`savvy-flow@claude-kit`), which you did not ask for. On its own it shows any subagents.

### 5. Claude Skins — changes how Claude Code looks
```bash
claude plugin marketplace add hellosverre/claude-skins
claude plugin install skins@hellosverre-mods --scope user
```
One network call found: a check of its own version file on GitHub (`raw.githubusercontent.com/hellosverre/claude-skins/...`).
Turn it off with `/skin off`; remove with `claude plugin uninstall skins@hellosverre-mods`.
Its README also advertises `mod-store` (about 2,700 more mods). Skip that: you did not review those.

### 6. Reflect — learns from your corrections
Pick **one** of the two forms. Installing both captures every correction twice.
```bash
claude plugin marketplace add bayramannakov/claude-reflect
claude plugin install claude-reflect@claude-reflect-marketplace --scope user    # plugin: queues corrections, you run /reflect
# OR
claude plugin install reflect-mod@claude-reflect-marketplace --scope user       # mod: a Haiku model check on each prompt
```
No network calls found. It reads your Claude session history in `~/.claude/projects`, and `/reflect` writes the
learnings you approve into `CLAUDE.md`. The mod form calls a model on eligible prompts, which uses tokens. I'd start with the
plugin form.

## Install with one setting changed

### 7. Cache Tax — warns before an expensive cold send, keeps the prompt cache warm
```bash
claude plugin marketplace add karanb192/claude-code-mods
claude plugin install cache-tax@claude-code-mods --scope user
```
The marketplace entry points to the same repo I reviewed (`karanb192/cache-tax`). No network calls found.
**It spends tokens on purpose.** By default, after you pay for a cold cache write it arms 3 hours of "keepwarm" pings.
Those pings are real requests that use your usage. After installing, open `/config`, find `cache-tax`, and set
**Auto keepwarm: off**. Then use `/keepwarm 90m` only when you want it. The guard that warns you before an expensive send is the
useful part, and it doesn't need keepwarm.

## Hold for now

### 8. Terminal Browser — a real browser inside the terminal
Its Claude Code plugin needs a separate program, installed with:
```
curl -fsSL https://terminal-browser.sh/install | bash
```
That runs whatever the website serves, with your permissions. My environment blocks that site, so **I could not read the
installer** and can't vouch for it. The plugin itself is marked "experimental" (v0.0.2), and an option lets Claude control
the browser (off by default). Its README also tells you to set `CLAUDE_CODE_ENABLE_FUNCTION_HOOKS`, which looks outdated; don't set
it unless Claude Code asks. If you still want it: read the installer in your browser first, or use the `brew install terminal-browser` route
(I haven't verified that formula exists).

### 9. You Should Know — built into Claude Code
No repo to review. You turn it on with:
```
/plugin enable cc-plugin-you-should-know@builtin
```
I couldn't check that command or what the mod does.

## What I did not check
- I did not run any code, and I did not install anything.
- I scanned for network calls, shell execution, base64 and credential access. A scan can miss things, especially in large
  files (several of these are 1,000+ line TypeScript files).
- Hooks and mods run with your user's permissions inside Claude Code. Anthropic's plugins docs explain how to review a
  plugin before you install it: https://code.claude.com/docs/en/plugins
