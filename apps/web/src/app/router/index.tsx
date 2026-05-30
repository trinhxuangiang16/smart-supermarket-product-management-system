import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "../../components/layout/app-shell";
import { useAuth } from "../../features/auth/auth-context";
import { LoginPage } from "../../features/auth/pages/login-page";
import { DashboardPage } from "../../features/dashboard/pages/dashboard-page";
import { ProductsPage } from "../../features/products/pages/products-page";
import { InventoryPage } from "../../features/inventory/pages/inventory-page";
import { SuppliersPage } from "../../features/suppliers/pages/suppliers-page";
import { CategoriesPage } from "../../features/categories/pages/categories-page";
import { ExpiryPage } from "../../features/expiry/pages/expiry-page";
import { ReportsPage } from "../../features/reports/pages/reports-page";
import { UsersPage } from "../../features/users/pages/users-page";
import { SettingsPage } from "../../features/settings/pages/settings-page";
import { HistoryActionsPage } from "../../features/audit/pages/history-actions-page";
import { AutomationPage } from "../../features/automation/pages/automation-page";
import { WarehousesPage } from "../../features/warehouses/pages/warehouses-page";
const Guard = ({ children }: { children: JSX.Element }) => {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
};
const RoleLanding = () => {
  const { user } = useAuth();
  if (["SALE_DEPARTMENT", "FINANCE_DEPARTMENT"].includes(user?.role ?? "")) {
    return <Navigate to="/reports" replace />;
  }
  return <DashboardPage />;
};
export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  {
    path: "/",
    element: <Guard><AppShell /></Guard>,
    children: [
      { index: true, element: <RoleLanding /> },
      { path: "products", element: <ProductsPage /> },
      { path: "inventory", element: <InventoryPage /> },
      { path: "suppliers", element: <SuppliersPage /> },
      { path: "categories", element: <CategoriesPage /> },
      { path: "warehouses", element: <WarehousesPage /> },
      { path: "expiry", element: <ExpiryPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "audit", element: <HistoryActionsPage /> },
      { path: "users", element: <UsersPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "automation", element: <AutomationPage /> },
    ],
  },
]);
