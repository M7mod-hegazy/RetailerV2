import React from "react";
import SimpleCrudPage from "../../components/crud/SimpleCrudPage";

export default function RevenueCategoriesPage() {
  return (
    <SimpleCrudPage
      title="تصنيفات الإيرادات الأخرى"
      endpoint="/api/revenues/categories"
      fields={[
        { name: "name", label: "اسم التصنيف", required: true },
        { name: "parent_id", label: "تصنيف أب", type: "number" },
      ]}
      columns={[
        { key: "id", label: "#" },
        { key: "name", label: "التصنيف" },
        { key: "parent_id", label: "الأب" },
      ]}
      buildPayload={(form) => ({
        name: form.name,
        parent_id: form.parent_id ? Number(form.parent_id) : null,
      })}
    />
  );
}
