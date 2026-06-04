import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";
import { Card } from "../../../components/ui/basic";
export const ExpiryPage = () => { const q = useQuery({ queryKey: ["expiry-alert"], queryFn: () => api<any>("/expiry/alerts") }); return <div className="space-y-4"><Card><div className="overflow-auto"><table className="table-warm w-full text-sm"><thead><tr><th>Product</th><th>Expiry Status</th><th>Suggested Action</th></tr></thead><tbody>{(q.data?.data ?? []).map((p:any)=><tr key={p.id}><td>{p.name}</td><td>{p.expiryStatus}</td><td>{p.expiryStatus==="ALERT_3"?"discount 20-30%":p.expiryStatus==="WARNING_15"?"discount 10-15%":p.expiryStatus==="EXPIRED"?"destroy":"monitor"}</td></tr>)}</tbody></table></div></Card></div>; };
