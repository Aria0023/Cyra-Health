// When did an app last call this server? (docs/plans/launch-tools.md Task 1.) The static app lives on another origin,
// so the server cannot read its settings; the one thing it can tell the owner is the time of the last request that
// carried an app Origin: an origin CORS allows (CORS_ORIGIN, or any when that is unset) that is not this server's own
// (the portal's pages are same-origin). Kept: ONE timestamp, in memory only. Never the address, the origin, the path
// or anything else about the request; nothing is written to disk and a restart clears it.
export function appSeen({ origins = ["*"], clock = Date.now } = {}) {
  let at = null;
  const middleware = (req, res, next) => {
    const origin = req.get("origin");
    if (origin && origin !== "null" && (origins.includes("*") || origins.includes(origin)) && origin !== `${req.protocol}://${req.get("host")}`) at = clock();
    next();
  };
  return { middleware, last: () => (at == null ? null : new Date(at).toISOString()) };
}
