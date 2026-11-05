# Social link previews

POT emits Open Graph metadata and an X/Twitter large-image card on the server. Preview crawlers
do not need to execute JavaScript. The homepage and application entry pages have route-specific
titles, descriptions, canonical URLs, absolute image URLs, image dimensions, alt text, site name,
and locale. The 1200 × 630 PNG uses the POT mark, brand line, colors, and headline.

Public pot links use the verified pot's name, description, and a pot-specific card with confirmed
contributions. Private, missing, and unavailable pots use the same generic branded fallback.
Private access fragments are never passed to metadata or image generation. Public-pot images
are not cached by the app, but a social platform can independently cache a previously public
preview; changing visibility cannot erase copies already collected by an external platform.

## Deployment

Set `NEXT_PUBLIC_SITE_URL` to the final public HTTPS origin and rebuild. It defaults to
`https://potonbase.vercel.app`, the repository's existing deployment address. The preview image
URL must be reachable without login, deployment protection, or cookies. A localhost URL cannot
be fetched by external social services. These local changes must be deployed before shared
production links show the new brand.

The crawler list preserves Next.js's supported bots and adds Telegram, Pinterest, Meta external
agents, Iframely, and Embedly. Automated tests request raw HTML using Facebook, X, LinkedIn,
WhatsApp, Telegram, Discord, and Slack user agents, and verify actual image responses and PNG
dimensions. This verifies the site's response contract, not an end-to-end post on each service.

## Check a deployed link

1. Fetch the page as a crawler and confirm the metadata is in the HTML head.
2. Open its `og:image` URL directly. It must return an image, not an authentication page.
3. Use the platform's preview inspector or paste the URL into a new message or post.
4. If a preview is stale, refresh it using the service's inspection tool where available.

Supported link-card placements decide their own appearance and caching. Some social placements
do not display rich cards at all. The public pot page also offers **Download share card** so its
PNG can be uploaded directly where a link preview is unavailable. Private pots intentionally do
not offer a personalized public card.

References: [Open Graph specification](https://ogp.me/) and
[LinkedIn's preview-cache guidance](https://www.linkedin.com/help/linkedin/answer/a6233775).
