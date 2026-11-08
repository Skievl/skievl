# Open business decisions — defaults used, need your approval

Each item was built with a sensible default so work wasn't blocked. Items marked ⚙️ can be changed in **Admin → Settings** with no code change.

## Money

| # | Decision | Default in the build | Notes / recommendation |
|---|---|---|---|
| 1 ⚙️ | Commission rate | **8%** (placeholder) | Stored per order at checkout, so changing it never affects past orders. |
| 2 ⚙️ | Commission on the drop-off fee? | **No.** The fee goes 100% to the seller. | The drop-off fee is recorded separately on every order either way. |
| 3 ⚙️ | Minimum fee per order | **$0** | **Recommend $2–3.** With destination charges, SKIEVL pays Stripe's processing fees (2.9% + 30¢ per card charge) out of its commission. Stripe Connect also bills the platform **$2 per seller per month in which they receive a payout, plus 0.25% + 25¢ per payout**. On a $25 item, 8% ($2.00) may not cover those costs. On a $350 item, 8% = $28.00, minus about $10.45 in processing, leaves roughly $17.50 before payout fees. |
| 4 | Who pays the fee | **The seller** (deducted from proceeds). Buyers pay item + drop-off only. | A buyer-side "service fee" can be added later. |
| 5 | When sellers get their money | **Transferred to the seller's Stripe balance at payment** and paid out on Stripe's standard schedule. | Simple, and sellers like it. Risk: if a seller no-shows after being paid out, refunds pull the money back from their Stripe balance (Stripe can debit their bank). Alternative: hold funds until the buyer confirms pickup (separate charges and transfers). That's safer for buyers but delays sellers; it's roughly a day of work to switch. |
| 6 | Sales tax | **Not collected.** | New York has marketplace-facilitator rules for sales tax. Ask an accountant whether and when SKIEVL must collect. Stripe Tax can be added to Checkout. |
| 7 | 1099-K forms for sellers | Not configured | In Stripe Dashboard → Connect → Tax reporting, decide whether Stripe files 1099s for sellers who cross IRS thresholds (Stripe charges per form). |

## Listings and safety

| # | Decision | Default | Notes |
|---|---|---|---|
| 8 ⚙️ | Approve listings before they go live | **On** | Good for launch trust. Turn off once volume grows. Edits to an already-approved listing do **not** go back to review; community reports catch problems. |
| 9 ⚙️ | Price limits | Max item price **$5,000**; max drop-off fee **$100** | |
| 10 | Used helmets and bindings | Allowed, with a safety notice in Terms and How-it-works | Some marketplaces ban used helmets. Decide whether to add "never crashed" as a required attribute, or ban them. |
| 11 | Photos | 1–12 per listing, required to publish | Resized in the browser to 1800px; this also strips GPS data. |
| 12 | Drop-off area | Seller lists **ZIP codes**. Quick-add suggestions: 14731 Ellicottville, 14741 Great Valley, 14779 Salamanca, 14755 Little Valley, 14760 Olean, 14141 Springville. | Simple and verifiable. A radius in miles would need geocoding. |
| 13 | Gender filter | Choosing Men's or Women's also shows Unisex items | Usually what shoppers want. |

## Orders

| # | Decision | Default | Notes |
|---|---|---|---|
| 14 ⚙️ | Checkout hold | **35 minutes** (Stripe Checkout sessions last 31) | No one else can buy the item while it's held. |
| 15 ⚙️ | Auto-complete | **3 days** after the seller marks "picked up / delivered", if the buyer doesn't confirm | Completion unlocks the review. |
| 16 | Cancellations | The seller can cancel before handoff (buyer fully refunded, SKIEVL keeps no fee). Buyers cancel through support or an admin. | Write a public cancellation and refund policy. |
| 17 | Disputes / chargebacks | Admins are alerted by email; evidence is submitted in the Stripe Dashboard | With destination charges the platform is debited first. Decide whether to recover the amount from the seller. |
| 18 | Payment methods | Cards (including Apple Pay and Google Pay) only | Delayed methods like ACH are disabled because they can't settle within the hold window. |

## Accounts and legal

| # | Decision | Default | Notes |
|---|---|---|---|
| 19 | Minimum age | 18+ (in the draft Terms) | |
| 20 | Terms of Service and Privacy Policy | **Drafts only** (/terms, /privacy) | **Need lawyer review before launch.** |
| 21 | Messaging | Buyer↔seller messages per listing, with a warning when off-platform payment apps are mentioned | |
| 22 | Analytics | GA4 loads only if `NEXT_PUBLIC_GA_ID` is set | GA may require a cookie notice depending on your audience. Vercel Analytics is a cookie-free alternative. |
| 23 | Brand list | 10 featured brands from the spec plus about 40 more | Editable in Admin → Catalog. |
