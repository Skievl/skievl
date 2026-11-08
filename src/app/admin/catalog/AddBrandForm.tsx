"use client";
import { useActionState } from "react";
import { addBrand } from "@/app/actions/admin";
import { FormMessage, SubmitButton, initialState } from "@/components/forms";

export function AddBrandForm() {
  const [state, action] = useActionState(addBrand, initialState);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input name="name" required maxLength={60} placeholder="New brand name" className="input w-56" aria-label="Brand name" />
      <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="is_featured" /> Featured</label>
      <SubmitButton className="btn-secondary">Add brand</SubmitButton>
      <div className="w-full"><FormMessage state={state} /></div>
    </form>
  );
}
