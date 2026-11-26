# Buffer setup checklist

Three jobs, in this order. Tick each box as you go. A session of Claude controlling your Chrome can do the clicking while you watch. See "Rules for Claude" at the bottom first.

Where things live:
- Vercel project: `evan-enterprises-os` (site at https://evan-enterprises-os.vercel.app)
- Supabase project: `hzcgdnhecgewqpcnumwm` (https://hzcgdnhecgewqpcnumwm.supabase.co)
- Your Buffer account: the one with your own channels, not anyone else's

---

## Job 1: Buffer

- [ ] Log in to https://buffer.com with **your own** account. Check the email shown in the account menu is yours.
- [ ] Make sure these five channels are connected: Instagram, Facebook, TikTok, YouTube, LinkedIn. (Five channels need a paid Buffer plan. The free plan allows 3.)
  - Instagram: a Business or Creator account can auto-publish. A personal profile can only send reminders.
- [ ] Create an API key: https://publish.buffer.com/settings/api, then "Create a new API key", then copy it. **Keep it in the clipboard for Job 2. Never paste it into a chat or a file.**
- [ ] Find your **organization ID**. Easiest way: in a new Claude Code session with the Buffer connector attached to your own account, ask "what's my Buffer organization ID?". It reads it from your account. It is a 24-character string of letters a-f and numbers.

## Job 2: Vercel (keys and settings)

Open https://vercel.com, go to the `evan-enterprises-os` project, then Settings, then Environment Variables. Apply to **Production**.

- [ ] Add `BUFFER_ACCESS_TOKEN` = the Buffer API key from Job 1.
- [ ] Add `BUFFER_ORG_ID` = the organization ID from Job 1. The code has an old fallback ID, so this one must be set.
- [ ] Check `CRON_SECRET` already exists. **If it exists, leave it alone.** If not, add it with a long random value (32+ characters). Vercel uses it to authorize the daily sync.
- [ ] Check `INTERNAL_API_KEY` already exists. **If it exists, leave it alone. Replacing it would break other features that use it.** If not, add it with a long random value. Write it down privately. You need the same value on your computer in Job 4.
- [ ] Confirm these existing ones are still there: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`. Do not change them.
- [ ] Redeploy so the new variables take effect: Deployments, open the latest one, the "..." menu, Redeploy.

## Job 3: Supabase (analytics table)

- [ ] Open https://supabase.com/dashboard/project/hzcgdnhecgewqpcnumwm/sql/new
- [ ] Open the file `supabase/social-analytics.sql` from the repo (https://github.com/seanjevangelista-pixel/evan-enterprises-os/blob/main/supabase/social-analytics.sql), copy all of it, paste it into the SQL editor, and click Run.
- [ ] Expect "Success. No rows returned." Running it twice is safe.
- [ ] Optional: Storage, then the `media` bucket. It is created automatically the first time you upload a video. Supabase's default per-file limit is 50 MB, so very large videos will be rejected. Edited clips (30 to 60 MB) are usually fine.

---

## Check it works

1. [ ] Log in to the dashboard (https://evan-enterprises-os.vercel.app/dashboard), open the **Social** tab, and press **Sync from Buffer**. Expect "Synced N posts" (0 is fine if you haven't posted yet). An error mentioning `social_posts` means Job 3 didn't run. An error mentioning `BUFFER_ACCESS_TOKEN` means Job 2 isn't applied. Redeploy.
2. [ ] In the Social tab's "Post a clip" form, press **Preview** with any public https link to an mp4 and a test caption. It should list your connected channels and send nothing.
3. [ ] First real test: send one short video as a **draft** (leave "Save as drafts" ticked) and check it appears as a draft in Buffer. Delete it there afterwards.

## Job 4 (on your Mac, or Windows with WSL2): the command

The `post-folder` command lives in `clipping-studio/setup.sh`, which runs on macOS or Linux (on Windows, inside WSL2). It does not run in plain PowerShell.

- [ ] Run `setup.sh`, then put your `INTERNAL_API_KEY` (same value as Vercel) in `~/clipping-studio/.social.env`.
- [ ] Test with `~/clipping-studio/post-folder <folder> --dry-run`, then without `--dry-run` (drafts only). Add `--send` only when you want posts queued for real.

---

## Rules for Claude (when it is controlling the browser)

- Show each step on screen and say what you are about to do before you do it.
- **Stop and hand over** at any login, password, two-factor prompt or "approve access" screen. The user does those.
- Never type, paste or repeat an API key, token or secret into chat, a file or a message. Only move it from the page where it is shown to the page where it goes, via the clipboard.
- Do not change or delete any existing environment variable. Only add the ones listed.
- Do not open or use any tab unrelated to this checklist (banking, trading, crypto wallet).
- If anything looks different from this checklist, stop and ask instead of guessing.
