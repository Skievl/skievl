import Link from "next/link";
import { requireSeller } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getBrands, getCategories } from "@/lib/catalog";
import { Notice, PageHeader } from "@/components/ui";
import { ListingForm } from "../ListingForm";

export const metadata = { title: "New listing" };

export default async function NewListingPage() {
  const { seller } = await requireSeller();
  const supabase = await createClient();
  const [categories, brands, { count }] = await Promise.all([
    getCategories(),
    getBrands(),
    supabase.from("dropoff_areas").select("id", { count: "exact", head: true }).eq("seller_id", seller.user_id),
  ]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="List an item" subtitle="Step 1 of 2: details. Next you'll add photos and publish." />
      {!seller.charges_enabled && (
        <div className="mb-6">
          <Notice tone="warn">
            You can save drafts now, but you&apos;ll need to <Link href="/sell/setup#payouts" className="font-semibold underline">set up payouts</Link> before publishing.
          </Notice>
        </div>
      )}
      <ListingForm categories={categories} brands={brands} hasDropoffArea={(count ?? 0) > 0} />
    </div>
  );
}
