import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  LogOut,
  FolderOpen,
  BarChart3
} from "lucide-react";
import Logo from "@/components/Logo";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRole(session.user.id);
      } else {
        setRole(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (data) setRole(data.role);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
    });
    navigate("/");
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-card border-r border-border p-6 flex flex-col z-50">
      <Logo />

      <nav className="mt-10 flex-1 space-y-2">
        <Button
          variant={isActive("/dashboard") || isActive("/dashboard/digital-marketing") ? "secondary" : "ghost"}
          className="w-full justify-start gap-3"
          onClick={() => {
            switch (role) {
              case 'digital_marketing_manager':
                navigate("/dashboard/digital-marketing");
                break;
              case 'copywriter':
                navigate("/dashboard/copywriter");
                break;
              case 'copy_qc':
                navigate("/dashboard/copy-qc");
                break;
              case 'designer':
                navigate("/dashboard/designer");
                break;
              case 'designer_qc':
                navigate("/dashboard/designer-qc");
                break;
              case 'admin':
                navigate("/dashboard");
                break;
              default:
                navigate("/dashboard");
            }
          }}
        >
          <LayoutDashboard className="w-5 h-5" />
          Dashboard
        </Button>

        {role === 'admin' && (
          <>
            <Button
              variant={isActive("/dashboard/employees") ? "secondary" : "ghost"}
              className="w-full justify-start gap-3"
              onClick={() => navigate("/dashboard/employees")}
            >
              <Users className="w-5 h-5" />
              Team
            </Button>

            <Button
              variant={isActive("/dashboard/admin-metrics") ? "secondary" : "ghost"}
              className="w-full justify-start gap-3"
              onClick={() => navigate("/dashboard/admin-metrics")}
            >
              <BarChart3 className="w-5 h-5" />
              Agency Metrics
            </Button>

          </>
        )}
      </nav>

      <div className="pt-6 border-t border-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-semibold">
              {user?.user_metadata?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">
              {user?.user_metadata?.full_name || "User"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
        <Button variant="outline" className="w-full gap-2" onClick={handleSignOut}>
          <LogOut className="w-4 h-4" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;
