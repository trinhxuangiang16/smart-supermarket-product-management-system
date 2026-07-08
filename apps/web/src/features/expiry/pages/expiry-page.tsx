import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "../../../lib/api-client";
import { Card } from "../../../components/ui/basic";

export const ExpiryPage = () => {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ["expiry-alert"], queryFn: () => api<any>("/expiry/alerts") });

  const getAction = (status: string) => {
    if (status === "ALERT_3") return t("pages.expiry.table.actions.discount20");
    if (status === "WARNING_15") return t("pages.expiry.table.actions.discount10");
    if (status === "EXPIRED") return t("pages.expiry.table.actions.destroy");
    return t("pages.expiry.table.actions.monitor");
  };

  return (
    <div className="space-y-4">
      <Card>
        <div className="overflow-auto">
          <table className="table-warm w-full text-sm">
            <thead>
              <tr>
                <th>{t("pages.expiry.table.headers.product")}</th>
                <th>{t("pages.expiry.table.headers.expiryStatus")}</th>
                <th>{t("pages.expiry.table.headers.suggestedAction")}</th>
              </tr>
            </thead>
            <tbody>
              {(q.data?.data ?? []).map((p: any) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.expiryStatus}</td>
                  <td>{getAction(p.expiryStatus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
