import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "../../../components/ui/basic";
import { api } from "../../../lib/api-client";

export const AutomationPage = () => {
  const qc = useQueryClient();
  const jobs = useQuery({
    queryKey: ["automation-jobs"],
    queryFn: () => api<any>("/automation/jobs"),
  });

  const runExpirySync = useMutation({
    mutationFn: () => api("/automation/jobs/expiry-sync/run", { method: "POST" }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["automation-jobs"] }),
        qc.invalidateQueries({ queryKey: ["products"] }),
        qc.invalidateQueries({ queryKey: ["expiry"] }),
        qc.invalidateQueries({ queryKey: ["kpi"] }),
      ]);
    },
  });
  const runKpiSnapshot = useMutation({
    mutationFn: () => api("/automation/jobs/kpi-snapshot/run", { method: "POST" }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["automation-jobs"] }),
        qc.invalidateQueries({ queryKey: ["kpi"] }),
      ]);
    },
  });

  const expiryJob = jobs.data?.data?.expirySync;
  const kpiJob = jobs.data?.data?.kpiSnapshot;

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Expiry Status Sync</h2>
            <p className="text-sm text-slate-500">Recalculate expiry statuses from current date and expiry date.</p>
          </div>
          <button
            className="h-10 rounded bg-slate-900 px-4 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-40"
            onClick={() => runExpirySync.mutate()}
            disabled={runExpirySync.isPending}
          >
            {runExpirySync.isPending ? "Running..." : "Run Job"}
          </button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">KPI Snapshot</h2>
            <p className="text-sm text-slate-500">Capture current KPI baseline for operations tracking.</p>
          </div>
          <button
            className="h-10 rounded bg-indigo-700 px-4 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-40"
            onClick={() => runKpiSnapshot.mutate()}
            disabled={runKpiSnapshot.isPending}
          >
            {runKpiSnapshot.isPending ? "Running..." : "Run Snapshot"}
          </button>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold">Latest Expiry Sync Run</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded border bg-slate-50 p-3 text-sm">
            <div className="text-xs text-slate-500">Status</div>
            <div className="font-medium">{expiryJob?.status ?? "IDLE"}</div>
          </div>
          <div className="rounded border bg-slate-50 p-3 text-sm">
            <div className="text-xs text-slate-500">Started At</div>
            <div className="font-medium">{expiryJob?.startedAt ? new Date(expiryJob.startedAt).toLocaleString("en-US") : "-"}</div>
          </div>
          <div className="rounded border bg-slate-50 p-3 text-sm">
            <div className="text-xs text-slate-500">Finished At</div>
            <div className="font-medium">{expiryJob?.finishedAt ? new Date(expiryJob.finishedAt).toLocaleString("en-US") : "-"}</div>
          </div>
          <div className="rounded border bg-slate-50 p-3 text-sm">
            <div className="text-xs text-slate-500">Summary</div>
            <div className="font-medium">
              {expiryJob?.summary ? `Scanned: ${expiryJob.summary.scanned ?? 0}, Updated: ${expiryJob.summary.updated ?? 0}` : "-"}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold">Latest KPI Snapshot Run</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded border bg-slate-50 p-3 text-sm">
            <div className="text-xs text-slate-500">Status</div>
            <div className="font-medium">{kpiJob?.status ?? "IDLE"}</div>
          </div>
          <div className="rounded border bg-slate-50 p-3 text-sm">
            <div className="text-xs text-slate-500">Started At</div>
            <div className="font-medium">{kpiJob?.startedAt ? new Date(kpiJob.startedAt).toLocaleString("en-US") : "-"}</div>
          </div>
          <div className="rounded border bg-slate-50 p-3 text-sm">
            <div className="text-xs text-slate-500">Finished At</div>
            <div className="font-medium">{kpiJob?.finishedAt ? new Date(kpiJob.finishedAt).toLocaleString("en-US") : "-"}</div>
          </div>
          <div className="rounded border bg-slate-50 p-3 text-sm">
            <div className="text-xs text-slate-500">Summary</div>
            <div className="font-medium">
              {kpiJob?.summary
                ? `Products: ${kpiJob.summary.totalProducts ?? 0}, Low stock: ${kpiJob.summary.lowStockProducts ?? 0}, Expired: ${kpiJob.summary.expiredProducts ?? 0}`
                : "-"}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
