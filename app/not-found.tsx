import { ZipForm } from "@/components/ZipForm";

export default function NotFound() {
  return (
    <div className="pt-10">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-3 text-muted">Try looking up a ZIP code instead.</p>
      <div className="mt-6 max-w-sm">
        <ZipForm size="sm" />
      </div>
    </div>
  );
}
