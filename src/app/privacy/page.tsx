export const metadata = { title: "Privacy Policy" };

// DRAFT — must be reviewed by a lawyer before launch (see DECISIONS.md).
export default function Privacy() {
  return (
    <div className="container-page prose-skievl max-w-3xl py-12">
      <h1 className="mb-2 text-3xl font-extrabold">Privacy Policy</h1>
      <p className="rounded-lg bg-gold/10 p-3 text-sm">Draft policy — pending legal review.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Account details: name, email, password (hashed by our auth provider).</li>
        <li>Seller details: shop name, town, and a private pickup address and optional phone number.</li>
        <li>Listings, photos, messages, orders and reviews you create.</li>
        <li>Payment and identity verification data is collected and held by Stripe, not by SKIEVL.</li>
      </ul>
      <h2>How we use it</h2>
      <p>To run the marketplace: show listings, process orders, share a seller’s pickup address with a buyer after payment, send transactional emails, prevent fraud, and moderate content.</p>
      <h2>What we share</h2>
      <p>With the other party to your transaction (as needed for handoff), with Stripe for payments, with our hosting, database and email providers, and when required by law. We do not sell personal information.</p>
      <h2>Photos</h2>
      <p>Photos are resized in your browser before upload, which removes embedded location (GPS) data.</p>
      <h2>Your choices</h2>
      <p>You can edit your profile, delete draft listings, and request account deletion by emailing support@skievl.com. Some order records are retained for tax and accounting purposes.</p>
    </div>
  );
}
