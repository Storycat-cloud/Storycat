import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2, UserPlus, Trash2, Clock, History } from "lucide-react";

interface Profile {
  id: string;
  full_name: string | null;
  role: string;
  star_rating: number;
  daily_copy_capacity: number;
  daily_design_capacity: number;
  daily_qc_capacity: number;
  weekly_capacity: number;
  created_at: string;
}

const Employees = () => {
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEmployee, setNewEmployee] = useState({
    email: "",
    password: "",
    full_name: "",
    role: "",
    star_rating: 3,
    daily_copy_capacity: 0,
    daily_design_capacity: 0,
    daily_qc_capacity: 0,
    weekly_capacity: 50
  });
  const [createLoading, setCreateLoading] = useState(false);

  // Work Log State
  const [isLogDialogOpen, setIsLogDialogOpen] = useState(false);
  const [selectedEmployeeName, setSelectedEmployeeName] = useState("");
  const [workLogs, setWorkLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const { toast } = useToast();

  const fetchEmployees = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, star_rating, daily_copy_capacity, daily_design_capacity, daily_qc_capacity, weekly_capacity, created_at')
        .neq('role', 'admin'); // Fetch all non-admin employees

      if (error) throw error;
      setEmployees(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching employees",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleViewLogs = async (employee: Profile) => {
    setSelectedEmployeeName(employee.full_name || "Employee");
    setIsLogDialogOpen(true);
    setLogsLoading(true);

    try {
      // Fetch time logs for this user, join with projects and items
      const { data, error } = await supabase
        .from('time_logs')
        .select(`
                *,
                projects(title),
                content_items(dm_title)
            `)
        .eq('user_id', employee.id)
        .order('start_time', { ascending: false }); // Latest first

      if (error) throw error;
      setWorkLogs(data || []);

    } catch (error: any) {
      toast({
        title: "Error fetching logs",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLogsLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "-";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const handleDeleteEmployee = async (userId: string) => {
    try {
      // @ts-ignore - RPC types might not be generated
      const { error } = await supabase.rpc('delete_employee', {
        target_user_id: userId
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Employee deleted successfully",
      });
      fetchEmployees();
    } catch (error: any) {
      console.error("Delete error:", error);
      let msg = error.message || "Failed to delete employee";

      if (error && typeof error === 'object' && 'context' in error) {
        msg += ".";
        if (error.context && error.context.json) {
          const body = await error.context.json().catch(() => ({}));
          if (body.error) msg = body.error;
        }
      }

      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
    }
  };

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);

    try {
      // Call Supabase RPC to create user
      // @ts-ignore - RPC types might not be generated
      const { data, error } = await supabase.rpc('create_employee', {
        p_email: newEmployee.email,
        p_password: newEmployee.password,
        p_full_name: newEmployee.full_name,
        p_role: newEmployee.role,
        p_star_rating: newEmployee.star_rating,
        p_daily_copy_capacity: newEmployee.daily_copy_capacity,
        p_daily_design_capacity: newEmployee.daily_design_capacity,
        p_daily_qc_capacity: newEmployee.daily_qc_capacity,
        p_weekly_capacity: newEmployee.weekly_capacity
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Employee account created successfully",
      });

      setIsDialogOpen(false);
      setNewEmployee({
        email: "",
        password: "",
        full_name: "",
        role: "",
        star_rating: 3,
        daily_copy_capacity: 0,
        daily_design_capacity: 0,
        daily_qc_capacity: 0,
        weekly_capacity: 50
      });
      fetchEmployees(); // Refresh list
    } catch (error: any) {
      console.error(error);
      let msg = error.message || "Failed to create employee.";

      if (error && typeof error === 'object' && 'context' in error) {
        msg += " Check console for details.";
        if (error.context && error.context.json) {
          const body = await error.context.json().catch(() => ({}));
          if (body.error) msg = body.error;
        }
      }

      toast({
        title: "Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Team Management</h1>
          <p className="text-muted-foreground">Manage your agency employees and their access.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="w-4 h-4" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateEmployee} className="space-y-4 mt-4">
              <div>
                <Input
                  placeholder="Full Name"
                  value={newEmployee.full_name}
                  onChange={(e) => setNewEmployee({ ...newEmployee, full_name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Input
                  type="email"
                  placeholder="Email Address"
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                  required
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Password"
                  value={newEmployee.password}
                  onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div>
                <Select
                  value={newEmployee.role}
                  onValueChange={(value) => setNewEmployee({ ...newEmployee, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="digital_marketing_manager">Digital Marketing Manager</SelectItem>
                    <SelectItem value="copywriter">Copywriter</SelectItem>
                    <SelectItem value="copy_qc">Copy QC</SelectItem>
                    <SelectItem value="designer">Designer</SelectItem>
                    <SelectItem value="designer_qc">Designer QC</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Star Rating (1-5)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Button
                      key={star}
                      type="button"
                      variant={newEmployee.star_rating >= star ? "hero" : "outline"}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setNewEmployee({ ...newEmployee, star_rating: star })}
                    >
                      ★
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-4 p-4 bg-black/20 rounded-xl">
                <label className="text-sm font-medium">Daily Capacity by Work Type</label>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Copy</label>
                    <Input
                      type="number"
                      min={0}
                      value={newEmployee.daily_copy_capacity}
                      onChange={(e) => setNewEmployee({ ...newEmployee, daily_copy_capacity: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">Design</label>
                    <Input
                      type="number"
                      min={0}
                      value={newEmployee.daily_design_capacity}
                      onChange={(e) => setNewEmployee({ ...newEmployee, daily_design_capacity: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-muted-foreground">QC</label>
                    <Input
                      type="number"
                      min={0}
                      value={newEmployee.daily_qc_capacity}
                      onChange={(e) => setNewEmployee({ ...newEmployee, daily_qc_capacity: parseInt(e.target.value) || 0 })}
                      placeholder="0"
                    />
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground italic">
                  Set capacity to 0 for work types this employee doesn't handle
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Weekly Capacity (CCUs)</label>
                <Input
                  type="number"
                  min={1}
                  value={newEmployee.weekly_capacity}
                  onChange={(e) => setNewEmployee({ ...newEmployee, weekly_capacity: parseInt(e.target.value) || 50 })}
                  required
                />
                <p className="text-[10px] text-muted-foreground italic">Standard: 50 Units/week</p>
              </div>

              <Button type="submit" className="w-full" disabled={createLoading}>
                {createLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Account
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card variant="glass">
        <CardHeader>
          <CardTitle>Employees</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : employees.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No employees found. Add one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Daily Capacity</TableHead>
                  <TableHead>Weekly CCUs</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {employees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.full_name || "N/A"}</TableCell>
                    <TableCell className="capitalize">{employee.role.replace(/_/g, ' ')}</TableCell>
                    <TableCell>
                      <div className="flex text-primary">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i}>{i < (employee.star_rating || 1) ? "★" : "☆"}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs space-y-0.5">
                        {employee.daily_copy_capacity > 0 && <div>Copy: {employee.daily_copy_capacity}/day</div>}
                        {employee.daily_design_capacity > 0 && <div>Design: {employee.daily_design_capacity}/day</div>}
                        {employee.daily_qc_capacity > 0 && <div>QC: {employee.daily_qc_capacity}/day</div>}
                        {!employee.daily_copy_capacity && !employee.daily_design_capacity && !employee.daily_qc_capacity && (
                          <span className="text-muted-foreground">Not set</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {employee.weekly_capacity || 50} Units
                    </TableCell>
                    <TableCell>{new Date(employee.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleViewLogs(employee)}>
                          <History className="w-4 h-4 mr-2" />
                          View Logs
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive/80">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete the employee account.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteEmployee(employee.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Work Logs Dialog */}
      <Dialog open={isLogDialogOpen} onOpenChange={setIsLogDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Work Logs: <span className="text-primary">{selectedEmployeeName}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="mt-4">
            {logsLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : workLogs.length === 0 ? (
              <div className="text-center p-12 bg-muted/20 rounded-xl border border-dashed">
                <p className="text-muted-foreground">No work logs found for this employee.</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Task</TableHead>
                      <TableHead>Time Range</TableHead>
                      <TableHead className="text-right">Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {workLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{new Date(log.start_time).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">{log.projects?.title || "Unknown Project"}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={log.content_items?.dm_title}>
                          {log.content_items?.dm_title || "Untitled Task"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(log.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -
                          {log.end_time ? new Date(log.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : <span className="text-green-500 font-bold ml-1">Active</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {log.end_time ? formatDuration(log.duration_seconds) : "Running..."}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Total Row */}
                    <TableRow className="bg-muted/50 font-bold">
                      <TableCell colSpan={4} className="text-right">Total Tracked Time</TableCell>
                      <TableCell className="text-right text-primary">
                        {formatDuration(workLogs.reduce((acc, log) => acc + (log.duration_seconds || 0), 0))}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Employees;

