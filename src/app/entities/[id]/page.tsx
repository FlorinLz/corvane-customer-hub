import { redirect } from "next/navigation";

// Brief 6.1: /entities/{id} redirects to /entities/{id}/overview (M1 AC11).
export default async function EntityRootPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/entities/${id}/overview`);
}
