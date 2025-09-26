
# MedCalcPWA - ICD-11 Integration (Cloudflare Worker Proxy)

Este addon conecta tu PWA con la API de ICD‑11 vía un Cloudflare Worker que:
1) Obtiene y cachea el token OAuth2 (client_credentials, scope `icdapi_access`).
2) Evita CORS para el front.
3) Expone endpoints simples `/icd/search` y `/icd/entity`.

## Pasos
1. Despliega tu Worker y define variables de entorno:
   - CLIENT_ID (secret)
   - CLIENT_SECRET (secret)
   - ALLOW_ORIGIN (texto; p.ej. https://jgrlga.github.io)
2. Cambia `ICD_PROXY_BASE` en `config.json` por la URL del Worker.
3. Importa `icd_oauth.js` en tu app y llama a `initICDFromConfig()`.
4. Usa `searchICD11("término", { lang: "es" })` y/o `getICD11EntityByUri(uri)`.
5. Inserta la leyenda legal del footer donde corresponda (`footer_leyenda.html`).

## Notas
- `TIMEOUT_MS` y `RETRY` son configurables en `config.json`.
- Este paquete no expone `client_id/secret` en el front.
- Requiere tu propio Worker implementando rutas `/icd/search` y `/icd/entity`.
