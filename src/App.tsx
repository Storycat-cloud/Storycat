import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import DigitalMarketingDashboard from "./pages/dashboards/DigitalMarketingDashboard";
import CopywriterDashboard from "./pages/dashboards/CopywriterDashboard";
import CopyQCDashboard from "./pages/dashboards/CopyQCDashboard";
import DesignerDashboard from "./pages/dashboards/DesignerDashboard";
import DesignerQCDashboard from "./pages/dashboards/DesignerQCDashboard";
import AdminMetricsDashboard from "./pages/dashboards/AdminMetricsDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/employees" element={<Employees />} />

          {/* Role Based Dashboards */}
          <Route path="/dashboard/digital-marketing" element={<DigitalMarketingDashboard />} />
          <Route path="/dashboard/copywriter" element={<CopywriterDashboard />} />
          <Route path="/dashboard/copy-qc" element={<CopyQCDashboard />} />
          <Route path="/dashboard/designer" element={<DesignerDashboard />} />
          <Route path="/dashboard/designer-qc" element={<DesignerQCDashboard />} />
          <Route path="/dashboard/admin-metrics" element={<AdminMetricsDashboard />} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
