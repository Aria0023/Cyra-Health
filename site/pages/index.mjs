/* The website's pages as plain HTML strings (docs/plans/website.md). Task 1 ships the address change only: a short
   front page that opens the web app, and the not-found page. */

const head = ({ title, description, redirect = false }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="icon" type="image/svg+xml" href="/app/icons/favicon.svg">
<link rel="stylesheet" href="/site.css">
${redirect ? '<script src="/go.js"></script>\n' : ""}</head>`;

export const homePage = () => `${head({ title: "Solia Health", description: "Solia Health: cycle, fertility, pregnancy, perimenopause and menopause tracking. Your health log lives on your device.", redirect: true })}
<body>
<main>
<h1>Solia Health</h1>
<p>Cycle, fertility, pregnancy, perimenopause and menopause tracking. Your health log lives on your device.</p>
<p><a class="btn" href="/app/">Open the web app</a></p>
</main>
</body>
</html>
`;

export const notFoundPage = () => `${head({ title: "Page not found · Solia Health", description: "This page doesn't exist." })}
<body>
<main>
<h1>This page doesn't exist</h1>
<p>The address may have changed. The web app is at <a href="/app/">/app/</a>.</p>
<p><a class="btn" href="/?site=1">Go to the Solia Health website</a></p>
</main>
</body>
</html>
`;
