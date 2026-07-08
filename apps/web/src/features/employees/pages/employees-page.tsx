import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from "../../../lib/api-client";
import { useAuth } from "../../auth/auth-context";
import { Button, Card, Input } from "../../../components/ui/basic";
import { useToast } from "../../../components/ui/toast";

const employeeFormSchema = z.object({
  code: z.string().trim().min(2, "Code must be at least 2 characters"),
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  departmentId: z.string().min(1, "Department is required"),
  position: z.string().trim().min(2, "Position is required"),
  hireDate: z.string().min(1, "Hire date is required"),
  salary: z.coerce.number().min(0, "Salary must be >= 0"),
  status: z.enum(["ACTIVE", "ON_LEAVE", "TERMINATED"]),
  userId: z.string().optional(),
});

type EmployeeForm = z.infer<typeof employeeFormSchema>;

type EmployeeRow = EmployeeForm & {
  id: string;
  department?: { id: string; name: string } | null;
  user?: { id: string; email: string; role: string } | null;
};

type DepartmentRow = {
  id: string;
  name: string;
  parentId?: string | null;
  parent?: { id: string; name: string } | null;
  _count?: { employees: number; children: number };
};

const emptyForm: EmployeeForm = {
  code: "", fullName: "", email: "", phone: "", departmentId: "",
  position: "", hireDate: "", salary: 0, status: "ACTIVE", userId: "",
};

const getStatusLabels = (t: any) => ({
  ACTIVE: t("pages.employees.status.active"),
  ON_LEAVE: t("pages.employees.status.onLeave"),
  TERMINATED: t("pages.employees.status.terminated"),
});

const statusBadge: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  ON_LEAVE: "bg-amber-100 text-amber-700",
  TERMINATED: "bg-red-100 text-red-700",
};

const money = (n: number) => `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

export const EmployeesPage = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { notify } = useToast();
  const canManage = ["ADMIN", "MANAGER"].includes(user?.role ?? "");
  const statusLabels = getStatusLabels(t);

  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);

  const [deptName, setDeptName] = useState("");
  const [deptParent, setDeptParent] = useState("");
  const [editingDept, setEditingDept] = useState<DepartmentRow | null>(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<EmployeeForm>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: emptyForm,
  });

  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (search.trim()) params.set("search", search.trim());
  if (departmentFilter) params.set("departmentId", departmentFilter);
  if (statusFilter) params.set("status", statusFilter);

  const employeesQuery = useQuery({
    queryKey: ["employees", page, search, departmentFilter, statusFilter],
    queryFn: () => api<any>(`/employees?${params.toString()}`),
  });
  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: () => api<any>("/departments"),
  });
  const usersQuery = useQuery({
    queryKey: ["users-for-employees"],
    queryFn: () => api<any>("/users?pageSize=100"),
    enabled: canManage,
  });

  const saveMutation = useMutation({
    mutationFn: (form: EmployeeForm) => editing
      ? api<any>(`/employees/${editing.id}`, { method: "PUT", body: JSON.stringify(form) })
      : api<any>("/employees", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: async () => {
      notify({ type: "success", message: editing ? t("pages.employees.messages.updated") : t("pages.employees.messages.created") });
      setEditing(null);
      reset(emptyForm);
      await qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) => notify({ type: "error", message: (e as Error).message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api<any>(`/employees/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      notify({ type: "success", message: t("pages.employees.messages.deleted") });
      await qc.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e) => notify({ type: "error", message: (e as Error).message }),
  });

  const saveDeptMutation = useMutation({
    mutationFn: () => editingDept
      ? api<any>(`/departments/${editingDept.id}`, { method: "PUT", body: JSON.stringify({ name: deptName.trim(), parentId: deptParent }) })
      : api<any>("/departments", { method: "POST", body: JSON.stringify({ name: deptName.trim(), parentId: deptParent }) }),
    onSuccess: async () => {
      notify({ type: "success", message: editingDept ? "Department updated" : "Department created" });
      setEditingDept(null);
      setDeptName("");
      setDeptParent("");
      await qc.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e) => notify({ type: "error", message: (e as Error).message }),
  });

  const deleteDeptMutation = useMutation({
    mutationFn: (id: string) => api<any>(`/departments/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      notify({ type: "success", message: "Department deleted" });
      await qc.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e) => notify({ type: "error", message: (e as Error).message }),
  });

  const startEdit = (row: EmployeeRow) => {
    setEditing(row);
    reset({
      code: row.code,
      fullName: row.fullName,
      email: row.email ?? "",
      phone: row.phone ?? "",
      departmentId: row.department?.id ?? "",
      position: row.position,
      hireDate: String(row.hireDate).slice(0, 10),
      salary: Number(row.salary),
      status: row.status,
      userId: row.user?.id ?? "",
    });
  };

  const data = employeesQuery.data?.data;
  const rows: EmployeeRow[] = data?.items ?? [];
  const departments: DepartmentRow[] = departmentsQuery.data?.data ?? [];
  const users = usersQuery.data?.data?.items ?? usersQuery.data?.data ?? [];
  const fieldError = (key: keyof EmployeeForm) => errors[key] ? <p className="mt-1 text-xs text-[#9c4326]">{errors[key]?.message as string}</p> : null;

  return (
    <div className="space-y-4">
      {canManage ? (
        <Card>
          <div className="mb-2 font-semibold">Departments</div>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
            <Input placeholder="Department name" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
            <select className="field-warm h-11 rounded border px-3 text-sm" value={deptParent} onChange={(e) => setDeptParent(e.target.value)} title="Parent department">
              <option value="">No parent (root)</option>
              {departments.filter((d) => d.id !== editingDept?.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <Button onClick={() => saveDeptMutation.mutate()} disabled={saveDeptMutation.isPending || deptName.trim().length < 2}>
              {editingDept ? "Save Department" : "Add Department"}
            </Button>
            {editingDept ? (
              <Button className="btn-muted-warm" onClick={() => { setEditingDept(null); setDeptName(""); setDeptParent(""); }}>Cancel</Button>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {departments.map((d) => (
              <span key={d.id} className="inline-flex items-center gap-2 rounded-full border border-[#ead6aa] bg-[#fff9ee] px-3 py-1.5 text-xs">
                <span className="font-medium">{d.parent ? `${d.parent.name} / ` : ""}{d.name}</span>
                <span className="text-muted-warm">({d._count?.employees ?? 0})</span>
                <button className="text-[#6f4f13] hover:underline" onClick={() => { setEditingDept(d); setDeptName(d.name); setDeptParent(d.parentId ?? ""); }}>
                  <Pencil size={12} />
                </button>
                <button
                  className="text-[#9c4326] hover:underline"
                  onClick={() => {
                    if (!window.confirm(`Delete department ${d.name}?`)) return;
                    deleteDeptMutation.mutate(d.id);
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </span>
            ))}
            {!departments.length && !departmentsQuery.isLoading ? <span className="text-xs text-muted-warm">No departments yet. Create the first one above.</span> : null}
          </div>
        </Card>
      ) : null}

      {canManage ? (
        <Card>
          <div className="mb-2 font-semibold">{editing ? `Edit Employee: ${editing.code}` : "Create Employee"}</div>
          <form onSubmit={handleSubmit((form) => saveMutation.mutate(form))}>
            <div className="grid gap-2 md:grid-cols-3">
              <div><Input placeholder="Employee code (unique)" {...register("code")} />{fieldError("code")}</div>
              <div><Input placeholder="Full name" {...register("fullName")} />{fieldError("fullName")}</div>
              <div><Input placeholder="Email (optional)" {...register("email")} />{fieldError("email")}</div>
              <div><Input placeholder="Phone (optional)" {...register("phone")} /></div>
              <div>
                <select className="field-warm h-11 w-full rounded border px-3 text-sm" {...register("departmentId")}>
                  <option value="">Select department...</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.parent ? `${d.parent.name} / ` : ""}{d.name}</option>)}
                </select>
                {fieldError("departmentId")}
              </div>
              <div><Input placeholder="Position" {...register("position")} />{fieldError("position")}</div>
              <div><Input type="date" title="Hire date" {...register("hireDate")} />{fieldError("hireDate")}</div>
              <div><Input type="number" step="0.01" placeholder="Salary" {...register("salary")} />{fieldError("salary")}</div>
              <div>
                <select className="field-warm h-11 w-full rounded border px-3 text-sm" {...register("status")}>
                  {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <select className="field-warm h-11 w-full rounded border px-3 text-sm" {...register("userId")}>
                  <option value="">No linked account</option>
                  {(Array.isArray(users) ? users : []).map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving..." : editing ? "Save Changes" : "Create Employee"}
              </Button>
              {editing ? <Button type="button" className="btn-muted-warm" onClick={() => { setEditing(null); reset(emptyForm); }}>Cancel</Button> : null}
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="mb-3 grid gap-2 md:grid-cols-[1fr_220px_180px_auto]">
          <Input placeholder="Search by name, code, email, position..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <select className="field-warm h-11 rounded border px-3 text-sm" value={departmentFilter} onChange={(e) => { setDepartmentFilter(e.target.value); setPage(1); }} title="Department filter">
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="field-warm h-11 rounded border px-3 text-sm" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} title="Status filter">
            <option value="">All statuses</option>
            {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <div className="self-center text-xs text-muted-warm">Total: {data?.total ?? 0}</div>
        </div>
        <div className="overflow-auto">
          <table className="table-warm w-full min-w-[1180px] text-sm">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left font-semibold">Code</th>
                <th className="px-3 py-2 text-left font-semibold">Full Name</th>
                <th className="px-3 py-2 text-left font-semibold">Department</th>
                <th className="px-3 py-2 text-left font-semibold">Position</th>
                <th className="px-3 py-2 text-left font-semibold">Contact</th>
                <th className="px-3 py-2 text-left font-semibold">Hired</th>
                <th className="px-3 py-2 text-right font-semibold">Salary</th>
                <th className="px-3 py-2 text-left font-semibold">Status</th>
                <th className="px-3 py-2 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employeesQuery.isLoading ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-warm">Loading employees...</td></tr>
              ) : null}
              {!employeesQuery.isLoading && !rows.length ? (
                <tr><td colSpan={9} className="px-3 py-8 text-center text-muted-warm">No employees found.</td></tr>
              ) : null}
              {rows.map((e) => (
                <tr key={e.id} className="border-b">
                  <td className="px-3 py-2 font-medium">{e.code}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{e.fullName}</div>
                    {e.user ? <div className="text-xs text-muted-warm">Account: {e.user.email} ({e.user.role})</div> : null}
                  </td>
                  <td className="px-3 py-2">{e.department?.name ?? "-"}</td>
                  <td className="px-3 py-2">{e.position}</td>
                  <td className="px-3 py-2">
                    <div className="text-xs">{e.email || "-"}</div>
                    <div className="text-xs text-muted-warm">{e.phone || "-"}</div>
                  </td>
                  <td className="px-3 py-2">{new Date(e.hireDate).toLocaleDateString("en-US")}</td>
                  <td className="px-3 py-2 text-right">{money(Number(e.salary))}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${statusBadge[e.status]}`}>{statusLabels[e.status]}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2 whitespace-nowrap">
                      {canManage ? (
                        <>
                          <button className="btn-secondary-warm inline-flex h-9 items-center gap-1 rounded px-3 text-xs font-semibold" onClick={() => startEdit(e)}>
                            <Pencil size={13} /> Edit
                          </button>
                          <button
                            className="btn-danger-warm inline-flex h-9 items-center gap-1 rounded px-3 text-xs font-semibold disabled:opacity-50"
                            disabled={deleteMutation.isPending}
                            onClick={() => {
                              if (!window.confirm(`Delete employee ${e.fullName}?`)) return;
                              deleteMutation.mutate(e.id);
                            }}
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </>
                      ) : <span className="text-xs text-muted-warm">Read-only</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Button className="h-9 px-3 text-xs" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
          <span className="text-xs text-muted-warm">Page {data?.page ?? 1} / {data?.totalPages ?? 1}</span>
          <Button className="h-9 px-3 text-xs" disabled={page >= (data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      </Card>
    </div>
  );
};
