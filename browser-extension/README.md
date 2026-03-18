# QuiverDM Browser Extension

## Development Setup

### 1. Generate stable extension ID keypair (one-time)

```bash
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem
```

Extract the public key for manifest.json `key` field:
```bash
openssl rsa -in key.pem -pubout -outform DER | openssl base64 -A
```

Add the output as `"key": "<base64>"` to `manifest.json`.

This gives you a stable `chrome-extension://<id>/` redirect URI.

**key.pem is gitignored — never commit it.**

### 2. Install dependencies

```bash
npm install
```

### 3. Build and load

```bash
npm run dev
```

Load `dist/` as unpacked extension at `chrome://extensions`.
