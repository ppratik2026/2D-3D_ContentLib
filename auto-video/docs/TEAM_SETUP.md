# Team setup: licence keys + shared data (Supabase, free)

The admin does this **once**. It takes about 10 minutes.

## 1. Create the free Supabase project

1. Go to **supabase.com** → Sign up (free) → **New project**.
   - Choose any name, a database password (keep it safe) and a region near you (Mumbai / Singapore).
2. When the project is ready, open **SQL Editor** → **New query**.
3. Paste everything from **`supabase_setup.sql`** (it is in the `docs` folder) → **Run**.
   - It should say "Success". You can run it again later; nothing is lost.
4. Open **Project Settings → API** (or **API Keys**) and note three things:
   - **Project URL**, like `https://abcd1234.supabase.co`.
   - **Publishable key** (`sb_publishable_…`) or the old **anon public** key (`eyJ…`).
   - **Secret key** (`sb_secret_…`) or the old **service_role** key (`eyJ…`). **Never share this one.** It stays only on the admin PC.

## 2. Admin PC: connect the app

1. Open Auto Video Studio. The sign-in screen appears.
2. Click **"I am the admin (first setup)"** and enter the 3 values. Click **Save & open Admin panel**.
3. In the Admin panel, type your name and click **+ New key**. That is your own key.
4. Close the panel and sign in with that key.
   - The server code is already saved on the admin PC, so you only need the key.

## 3. Give every worker a key

1. **Settings → Team → Admin panel → + New key** for each worker (for example "Ramesh – PC 3").
2. Send the worker two things:
   - their **licence key** (`AVS-XXXX-XXXX-XXXX`);
   - the **Team server code** (Settings → Team → Admin setup → Copy, starts with `AVS1:`).
3. The worker opens the app, pastes both, and clicks **Sign in**.
   - The key now belongs to that PC (1 key = 1 PC).

## 4. Managing keys (Admin panel)

| Button | What happens |
|---|---|
| **Block** | That PC stops working within 10 minutes. Videos in progress are stopped. **Unblock** brings it back. |
| **Log out now** | That PC is signed out within 10 minutes and needs the key again. Use **Block** if they should not sign in again. |
| **Reset PC** | Frees the key so it can be used on a new or repaired PC. |
| **Delete** | Removes the key for good. |

The table also shows the PC name, when each PC was last seen, and its app version.

## 5. Sharing data with everyone

1. On the admin PC, prepare the data:
   - Add backgrounds (with places marked).
   - Add your own characters (with voice, tags and styles).
   - Put any other shared files (story templates, music…) in `Documents\AutoVideo\data\shared`.
2. Click **Admin panel → Publish my data**. Only new or changed files are uploaded.
3. Workers get it automatically when the app starts, or with **Update data now**.
   - A **"New team data → Update"** button appears at the top.
   - Things the admin deleted are removed too. A worker's own extra backgrounds or characters are never touched.

## Good to know

- **Offline:** the app keeps working for 72 hours without internet, then asks to connect.
- **Free plan limits:** 1 GB storage and about 5 GB downloads a month.
  - Backgrounds are small (~1 MB each). Characters are 5–20 MB each.
  - Each PC downloads a file only once, plus later changes.
  - With 10 PCs this is fine. If you add many big characters often, watch the usage page in Supabase.
- **Lost secret key, or it leaked:** in Supabase, create a new secret key (or roll the old one) and enter the new one on the admin PC (Settings → Team → Admin setup).
- **Security:** only a fingerprint (hash) of each licence key is stored on the server. Workers' apps can only check a key and download the data; they cannot see or change other keys.
