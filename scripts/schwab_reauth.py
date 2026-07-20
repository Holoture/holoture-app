"""
Schwab OAuth re-authentication — run this roughly every 7 days.

Schwab's refresh token expires 7 days after issuance no matter how often
it's used (unlike most OAuth providers). There is no way to renew it
programmatically; this interactive browser flow is the only way.

Usage:
    pip install schwab-py
    python scripts/schwab_reauth.py

What it does:
  1. Opens a browser for you to log into Schwab and approve access.
  2. Writes the new refresh token into .env.local (SCHWAB_REFRESH_TOKEN).
  3. Prints the value so you can copy it into Vercel's production env vars
     (Project Settings -> Environment Variables -> SCHWAB_REFRESH_TOKEN).
     This script only updates your LOCAL .env.local — production still
     needs a manual update in the Vercel dashboard.

Requires SCHWAB_APP_KEY and SCHWAB_APP_SECRET already present in .env.local.
"""
import json
import os
import sys

ENV_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env.local')
TOKEN_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.schwab_token.json')


def load_env(path):
    env = {}
    if not os.path.exists(path):
        return env
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")
    return env


def write_env_var(path, key, value):
    lines = []
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    lines = [l for l in lines if not l.startswith(f'{key}=')]
    lines.append(f'{key}="{value}"\n')
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(lines)


def main():
    env = load_env(ENV_PATH)
    app_key = env.get('SCHWAB_APP_KEY')
    app_secret = env.get('SCHWAB_APP_SECRET')
    callback_url = env.get('SCHWAB_CALLBACK_URL', 'https://127.0.0.1:8182')

    if not app_key or not app_secret:
        print('Missing SCHWAB_APP_KEY / SCHWAB_APP_SECRET in .env.local')
        sys.exit(1)

    from schwab.auth import easy_client

    print('Opening browser for Schwab login...')
    client = easy_client(
        api_key=app_key,
        app_secret=app_secret,
        callback_url=callback_url,
        token_path=TOKEN_PATH,
        interactive=False,
    )

    with open(TOKEN_PATH, 'r', encoding='utf-8') as f:
        token_data = json.load(f)
    refresh_token = token_data['token']['refresh_token']

    write_env_var(ENV_PATH, 'SCHWAB_REFRESH_TOKEN', refresh_token)
    os.remove(TOKEN_PATH)  # don't leave a second copy of the secret on disk

    print()
    print('Local .env.local updated.')
    print()
    print('NOW UPDATE PRODUCTION: copy this value into Vercel')
    print('(Project Settings -> Environment Variables -> SCHWAB_REFRESH_TOKEN):')
    print()
    print(refresh_token)

    # Sanity check.
    resp = client.get_quote('AAPL')
    print()
    print(f'Sanity check -- GET /quote AAPL: HTTP {resp.status_code}')


if __name__ == '__main__':
    import multiprocess
    multiprocess.freeze_support()
    main()
