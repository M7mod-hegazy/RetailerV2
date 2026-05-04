import React from "react";
import SimpleCrudPage from "../../components/crud/SimpleCrudPage";

export default function UsersPage() {
  return (
    <SimpleCrudPage
      title="المستخدمون والصلاحيات"
      endpoint="/api/users"
      fields={[
        { name: "full_name", label: "الاسم الكامل", required: true },
        { name: "username", label: "اسم المستخدم", required: true },
        { name: "password", label: "كلمة المرور", type: "password", required: true, requiredOnEdit: false },
        { name: "role", label: "الدور" },
      ]}
      columns={[
        { key: "full_name", label: "الاسم" },
        { key: "username", label: "اسم المستخدم" },
        { key: "role", label: "الدور" },
        { key: "is_active", label: "نشط" },
      ]}
    />
  );
}
