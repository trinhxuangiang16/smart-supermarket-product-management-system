import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Button, Card } from "../../../components/ui/basic";
import { api } from "../../../lib/api-client";

export const AutomationPage = () => {
  const { t } = useTranslation();
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
            <h2 className="text-base font-semibold">{t("pages.automation.jobs.expiry.title")}</h2>
            <p className="text-sm text-muted-warm">{t("pages.automation.jobs.expiry.description")}</p>
          </div>
          <Button
            className="h-10 px-4"
            onClick={() => runExpirySync.mutate()}
            disabled={runExpirySync.isPending}
          >
            {runExpirySync.isPending ? t("pages.automation.jobs.expiry.running") : t("pages.automation.jobs.expiry.run")}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">{t("pages.automation.jobs.kpi.title")}</h2>
            <p className="text-sm text-muted-warm">{t("pages.automation.jobs.kpi.description")}</p>
          </div>
          <Button
            className="h-10 px-4"
            onClick={() => runKpiSnapshot.mutate()}
            disabled={runKpiSnapshot.isPending}
          >
            {runKpiSnapshot.isPending ? t("pages.automation.jobs.kpi.running") : t("pages.automation.jobs.kpi.run")}
          </Button>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold">{t("pages.automation.labels.latest")} {t("pages.automation.jobs.expiry.title")}</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="panel-warm-muted rounded p-3 text-sm">
            <div className="text-xs text-muted-warm">{t("pages.automation.labels.status")}</div>
            <div className="font-medium">{expiryJob?.status ?? t("pages.automation.status.idle")}</div>
          </div>
          <div className="panel-warm-muted rounded p-3 text-sm">
            <div className="text-xs text-muted-warm">{t("pages.automation.labels.startedAt")}</div>
            <div className="font-medium">{expiryJob?.startedAt ? new Date(expiryJob.startedAt).toLocaleString("en-US") : "-"}</div>
          </div>
          <div className="panel-warm-muted rounded p-3 text-sm">
            <div className="text-xs text-muted-warm">{t("pages.automation.labels.finishedAt")}</div>
            <div className="font-medium">{expiryJob?.finishedAt ? new Date(expiryJob.finishedAt).toLocaleString("en-US") : "-"}</div>
          </div>
          <div className="panel-warm-muted rounded p-3 text-sm">
            <div className="text-xs text-muted-warm">{t("pages.automation.labels.summary")}</div>
            <div className="font-medium">
              {expiryJob?.summary ? `Scanned: ${expiryJob.summary.scanned ?? 0}, Updated: ${expiryJob.summary.updated ?? 0}` : "-"}
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold">{t("pages.automation.labels.latest")} {t("pages.automation.jobs.kpi.title")}</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="panel-warm-muted rounded p-3 text-sm">
            <div className="text-xs text-muted-warm">Status</div>
            <div className="font-medium">{kpiJob?.status ?? "IDLE"}</div>
          </div>
          <div className="panel-warm-muted rounded p-3 text-sm">
            <div className="text-xs text-muted-warm">Started At</div>
            <div className="font-medium">{kpiJob?.startedAt ? new Date(kpiJob.startedAt).toLocaleString("en-US") : "-"}</div>
          </div>
          <div className="panel-warm-muted rounded p-3 text-sm">
            <div className="text-xs text-muted-warm">Finished At</div>
            <div className="font-medium">{kpiJob?.finishedAt ? new Date(kpiJob.finishedAt).toLocaleString("en-US") : "-"}</div>
          </div>
          <div className="panel-warm-muted rounded p-3 text-sm">
            <div className="text-xs text-muted-warm">Summary</div>
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
