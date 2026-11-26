let cachedToken = null;
let tokenExpiresAt = 0;
let cachedCatalog = null;
let cachedCatalogAt = 0;
let catalogRefreshPromise = null;
const CATALOG_TTL = 10 * 60 * 1000;
const STALE_TTL = 60 * 60 * 1000;
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Range, Content-Type, If-Range, If-None-Match",
  "Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, ETag, Last-Modified"
};
function json(data, status = 200, extra = {}) {
  return Response.json(data, { status, headers: { ...corsHeaders, ...extra } });
}
function base64url(input) {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function decodePem(pem) {
  const clean = pem.replace(/-----BEGIN PRIVATE KEY-----/g, "").replace(/-----END PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const binary = atob(clean);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function getGoogleToken(env) {
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  const account = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(JSON.stringify({ iss: account.client_email, scope: "https://www.googleapis.com/auth/drive.readonly", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const unsigned = header + "." + claim;
  const key = await crypto.subtle.importKey("pkcs8", decodePem(account.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: unsigned + "." + base64url(new Uint8Array(signature)) })
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) throw new Error(result.error_description || result.error || "Google authentication failed");
  cachedToken = result.access_token;
  tokenExpiresAt = Date.now() + ((result.expires_in || 3600) - 60) * 1000;
  return cachedToken;
}
async function driveFetch(url, token, range) {
  const headers = { Authorization: "Bearer " + token };
  if (range) headers.Range = range;
  return fetch(url, { headers });
}
async function listChildren(folderId, token) {
  const files = [];
  let pageToken = "";
  do {
    const query = new URLSearchParams({
      q: "'" + folderId.replace(/'/g, "\\'") + "' in parents and trashed = false",
      pageSize: "1000", orderBy: "name",
      fields: "nextPageToken,files(id,name,mimeType,size,modifiedTime,md5Checksum)",
      supportsAllDrives: "true", includeItemsFromAllDrives: "true"
    });
    if (pageToken) query.set("pageToken", pageToken);
    const response = await driveFetch("https://www.googleapis.com/drive/v3/files?" + query, token);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "Google Drive listing failed");
    files.push(...(data.files || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  return files;
}
const isAudio = file => file.mimeType?.startsWith("audio/") || /\.(mp3|m4a|mp4a|aac|ogg|wav|flac|opus|wma|aif|aiff)$/i.test(file.name || "");
async function buildCatalog(env) {
  const token = await getGoogleToken(env);
  const songs = [];
  const visited = new Set();
  const queue = [{ id: env.GOOGLE_DRIVE_FOLDER_ID, path: "" }];
  let cursor = 0;
  while (cursor < queue.length) {
    const batch = queue.slice(cursor, cursor + 8);
    cursor += batch.length;
    const results = await Promise.all(batch.map(folder => listChildren(folder.id, token)));
    for (let i = 0; i < batch.length; i++) {
      const parent = batch[i];
      if (visited.has(parent.id)) continue;
      visited.add(parent.id);
      if (visited.size > 5000) throw new Error("Folder scan limit reached (5000 folders)");
      for (const file of results[i]) {
        if (file.mimeType === "application/vnd.google-apps.folder") {
          if (!visited.has(file.id)) queue.push({ id: file.id, path: parent.path ? parent.path + "/" + file.name : file.name });
        } else if (isAudio(file)) {
          songs.push({
            id: file.id, title: file.name.replace(/\.[^.]+$/, ""), filename: file.name,
            folderPath: parent.path, folderName: parent.path.split("/").pop() || "",
            mimeType: file.mimeType || "application/octet-stream",
            size: file.size ? Number(file.size) : null, modifiedTime: file.modifiedTime || null,
            streamUrl: "https://radio-songs-api.karanbharti9541.workers.dev/stream/" + encodeURIComponent(file.id)
          });
        }
      }
    }
  }
  songs.sort((a, b) => a.filename.localeCompare(b.filename));
  return { count: songs.length, foldersScanned: visited.size, songs };
}
function catalogResponse(data, state) {
  return json({ ...data, cache: state }, 200, {
    "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=3600",
    "X-Radio-Catalog": state
  });
}
export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (!["GET", "HEAD"].includes(request.method)) return json({ error: "Method not allowed" }, 405);
    const url = new URL(request.url);
    if (url.pathname === "/") return json({ service: "Radio Songs API", status: "running", endpoints: ["/songs", "/stream/FILE_ID"] });
    if (!env.GOOGLE_SERVICE_ACCOUNT_JSON || !env.GOOGLE_DRIVE_FOLDER_ID) return json({ error: "Google Drive secrets are missing" }, 500);
    try {
      if (url.pathname === "/songs") {
        const now = Date.now();
        if (cachedCatalog && now - cachedCatalogAt < CATALOG_TTL) return catalogResponse(cachedCatalog, "MEMORY");
        if (cachedCatalog && now - cachedCatalogAt < STALE_TTL) {
          if (!catalogRefreshPromise) {
            catalogRefreshPromise = buildCatalog(env).then(data => { cachedCatalog = data; cachedCatalogAt = Date.now(); }).catch(() => {}).finally(() => { catalogRefreshPromise = null; });
            ctx.waitUntil(catalogRefreshPromise);
          }
          return catalogResponse(cachedCatalog, "STALE");
        }
        const data = await buildCatalog(env);
        cachedCatalog = data;
        cachedCatalogAt = Date.now();
        return catalogResponse(data, "REFRESH");
      }
      if (url.pathname.startsWith("/stream/")) {
        const fileId = decodeURIComponent(url.pathname.slice("/stream/".length));
        if (!fileId || fileId.includes("/")) return json({ error: "Invalid file ID" }, 400);
        const token = await getGoogleToken(env);
        const mediaUrl = "https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(fileId) + "?alt=media";
        const upstream = await driveFetch(mediaUrl, token, request.headers.get("Range"));
        if (!upstream.ok && upstream.status !== 206) {
          const detail = await upstream.text();
          return json({ error: "Google Drive audio request failed", status: upstream.status, details: detail.slice(0, 500) }, upstream.status);
        }
        const headers = new Headers(corsHeaders);
        for (const name of ["Content-Type", "Content-Length", "Content-Range", "Accept-Ranges", "ETag", "Last-Modified"]) {
          const value = upstream.headers.get(name);
          if (value) headers.set(name, value);
        }
        headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
        headers.set("Content-Disposition", "inline");
        return new Response(request.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
      }
      return json({ error: "Not found" }, 404);
    } catch (error) {
      return json({ error: "Google Drive integration failed", details: error.message || "Unknown error" }, 500);
    }
  }
};