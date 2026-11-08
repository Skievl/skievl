export const metadata = { title: "Terms of Service" };

// DRAFT — must be reviewed by a lawyer before launch (see DECISIONS.md).
export default function Terms() {
  return (
    <div className="container-page prose-skievl max-w-3xl py-12">
      <h1 className="mb-2 text-3xl font-extrabold">Terms of Service</h1>
      <p className="rounded-lg bg-gold/10 p-3 text-sm">Draft terms — pending legal review.</p>
      <h2>1. The marketplace</h2>
      <p>SKIEVL.com (“Ellicottville Ski Exchange”) is a venue that connects people buying and selling used ski and snowboard equipment. We are not the seller of items listed by members and do not take possession of them.</p>
      <h2>2. Accounts</h2>
      <p>You must be at least 18 to create an account, provide accurate information, and keep your credentials secure. We may suspend accounts that violate these terms.</p>
      <h2>3. Payments and fees</h2>
      <p>Payments are processed by Stripe. Sellers must complete Stripe’s onboarding and agree to the Stripe Connected Account Agreement. SKIEVL deducts a marketplace fee from each sale as displayed at the time of listing. Buyers pay the listed price plus any seller drop-off fee.</p>
      <h2>4. Listings</h2>
      <p>Sellers must own the items they list and describe their condition accurately. Prohibited: stolen goods, counterfeit items, recalled safety equipment, and anything unrelated to winter sports. We may remove listings at our discretion.</p>
      <h2>5. Pickup and drop-off</h2>
      <p>Buyers and sellers are responsible for arranging handoffs safely. Seller addresses are shared only for completed payments and may be used only to collect the purchased item.</p>
      <h2>6. Cancellations, refunds and disputes</h2>
      <p>Sellers may cancel before handoff, which refunds the buyer in full. If a handoff does not happen or an item is materially not as described, contact support before confirming receipt. Confirming receipt completes the order.</p>
      <h2>7. Safety equipment</h2>
      <p>Used bindings, helmets and other protective gear are sold as-is. Bindings should be inspected, adjusted and tested by a qualified technician before use. Helmets that have sustained an impact should not be used.</p>
      <h2>8. Reviews</h2>
      <p>Reviews must reflect a genuine transaction and may be moderated for abuse, fraud, or personal information.</p>
      <h2>9. Liability</h2>
      <p>To the extent permitted by law, SKIEVL is not liable for the condition, safety, or legality of items, or for the conduct of members.</p>
    </div>
  );
}
