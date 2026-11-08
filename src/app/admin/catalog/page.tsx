import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import { updateBrand, updateCategory } from "@/app/actions/admin";
import { AddBrandForm } from "./AddBrandForm";

export const dynamic = "force-dynamic";

export default async function AdminCatalog() {
  await requireAdmin();
  const db = createAdminClient();
  const [{ data: categories }, { data: brands }] = await Promise.all([
    db.from("categories").select("id, name, slug, is_active, sort_order, attribute_definitions(key, label, data_type, is_required)").order("sort_order"),
    db.from("brands").select("*").order("is_featured", { ascending: false }).order("name"),
  ]);

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section>
        <PageHeader title="Categories" subtitle="Category-specific size attributes are defined in the database (attribute_definitions)." />
        <ul className="card divide-y divide-line">
          {(categories ?? []).map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-4 p-3">
              <div>
                <p className={`font-semibold ${c.is_active ? "" : "text-muted line-through"}`}>{c.name}</p>
                <p className="text-xs text-muted">
                  {(c.attribute_definitions as { label: string; is_required: boolean }[]).map((a) => `${a.label}${a.is_required ? "*" : ""}`).join(" · ") || "No specific attributes"}
                </p>
              </div>
              <form action={updateCategory.bind(null, c.id, { is_active: !c.is_active })}>
                <button className="btn-ghost btn-sm">{c.is_active ? "Hide" : "Show"}</button>
              </form>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <PageHeader title="Brands" />
        <AddBrandForm />
        <ul className="card mt-4 max-h-[600px] divide-y divide-line overflow-y-auto">
          {(brands ?? []).map((b) => (
            <li key={b.id} className="flex items-center justify-between p-3 text-sm">
              <span className={b.is_active ? "" : "text-muted line-through"}>
                {b.name} {b.is_featured && <span className="badge bg-gold/20 text-[#8a5a10]">featured</span>}
              </span>
              <span className="flex gap-1">
                <form action={updateBrand.bind(null, b.id, { is_featured: !b.is_featured })}><button className="btn-ghost btn-sm">{b.is_featured ? "Unfeature" : "Feature"}</button></form>
                <form action={updateBrand.bind(null, b.id, { is_active: !b.is_active })}><button className="btn-ghost btn-sm">{b.is_active ? "Hide" : "Show"}</button></form>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
