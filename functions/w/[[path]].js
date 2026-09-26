// functions/w/[[path]].js - the game's wasm from R2, same-origin (t-5b3251,
// Harkfell's functions/play/w/[[path]].js in phantomburn's names).
//
// GET or HEAD /w/<sha16>/phantom-burn.wasm reads the R2 object with that key
// (env.WASM, bucket phantomburn-wasm, wrangler.jsonc) and answers it with an
// immutable cache (the name is its content), CORP and COEP (a Function's
// response never gets the tree's _headers), and ETag / 304 for revalidation.
// Anything else under /w/ is a plain 404: no traversal, no read-through.
// It imports nothing (tree-manifest refuses a Function that does).
const IMMUTABLE = "public, max-age=31536000, immutable";

function headersFor(object) {
  const h = new Headers();
  object.writeHttpMetadata(h);
  h.set("content-type", "application/wasm");
  h.set("cache-control", IMMUTABLE);
  h.set("etag", object.httpEtag);
  h.set("cross-origin-resource-policy", "same-origin");
  h.set("cross-origin-embedder-policy", "require-corp");
  h.set("x-content-type-options", "nosniff");
  h.set("x-robots-tag", "noindex");
  return h;
}

async function serveWasm(context, withBody) {
  const { params, env, request } = context;
  const parts = Array.isArray(params.path) ? params.path : [params.path];
  const tail = parts.join("/");
  if (!/^[0-9a-f]{16}\/phantom-burn\.wasm$/.test(tail)) {
    return new Response("not found\n", { status: 404, headers: { "x-robots-tag": "noindex" } });
  }
  const key = `w/${tail}`;
  if (!withBody) {
    const meta = await env.WASM.head(key);
    return meta ? new Response(null, { headers: headersFor(meta) }) : new Response(null, { status: 404 });
  }
  // only cache-validation preconditions go to R2, so a body-less object means 304
  const cond = new Headers();
  for (const h of ["if-none-match", "if-modified-since"]) if (request.headers.has(h)) cond.set(h, request.headers.get(h));
  const object = await env.WASM.get(key, { onlyIf: cond });
  if (!object) return new Response("not found\n", { status: 404, headers: { "x-robots-tag": "noindex" } });
  if (!("body" in object)) return new Response(null, { status: 304, headers: headersFor(object) });
  return new Response(object.body, { headers: headersFor(object) });
}

export const onRequestGet = (context) => serveWasm(context, true);
export const onRequestHead = (context) => serveWasm(context, false);
