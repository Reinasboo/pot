POT’s product promise and money rules were difficult to scan, and the interface lacked a consistent identity and complete social previews. This change introduces the “Big plans. One shared pot.” positioning, an original pooling mark and wordmark, and a responsive visual system across the landing page and app.

The landing page now has interactive trip, gift, and community examples that open editable plans. Plans can be saved locally, copied, or downloaded. The form rejects zero payout addresses and unsupported settlement modes, directs keyboard focus to errors or the resulting preview, and displays exact small contribution amounts without rounding them to zero.

Open Graph and large-image X cards are rendered on the server. Public pots get personalized cards; private or unavailable pots keep generic branded previews. Social crawlers do not receive private access keys. Deployment origin configuration, setup checks, and a testnet-only factory deployment script are documented.

The submission package includes six edited 1920×1080 product screenshots, a narrated 90-second 1080p/60fps product film with captions and an original score, and editable Remotion source. The token proposal is a future concept for community governance, grants, fee sponsorship, and useful ecosystem work; it does not replace USDC or grant control over individual pots.

Validation:
- Web lint, production build, and 75 unit tests passed.
- 40 browser tests passed across desktop/mobile; two desktop-only skips are intentional.
- 39 contract tests, contract build, and Foundry formatting passed.
- Social tests check raw crawler HTML, image responses and PNG dimensions, and private-pot fallback metadata.
- Production web dependencies and film dependencies returned no known npm audit vulnerabilities. The existing development-only ESLint advisory chain is documented.

Live Base Sepolia services, two-wallet transaction verification, and deployment remain external integration work. No transaction was broadcast by this change.

Implementation, design, and commit authorship: Codex.
