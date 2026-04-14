import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';

// Pages
import Login       from './pages/Login';
import Dashboard   from './pages/Dashboard';
import Leads       from './pages/Leads';
import LeadDetail  from './pages/LeadDetail';
import Sales       from './pages/Sales';
import CreateSale  from './pages/CreateSale';
import SaleDetail  from './pages/SaleDetail';
import Products    from './pages/Products';
import Vendors     from './pages/Vendors';
import PurchaseOrders from './pages/PurchaseOrders';
import CreatePurchaseOrder from './pages/CreatePurchaseOrder';
import Tasks       from './pages/Tasks';
import DailyReports from './pages/DailyReports';
import SalesTargets from './pages/SalesTargets';
import Campaigns    from './pages/Campaigns';
import UserManagement from './pages/UserManagement';
import Settings     from './pages/Settings';
import TodoList          from './pages/TodoList';
import EmployeeTracking  from './pages/EmployeeTracking';
import Quotations        from './pages/Quotations';

// Auth guard helper
const PrivateRoute = ({ element, roles }) => {
  const { isAuthenticated, user } = useAuthStore();
  
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  
  // If specific roles are required, check against logged-in user's role
  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return element;
};

function App() {
  const { checkAuth, isAuthenticated } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  return (
    <Router>
      <Routes>
        {/* Public */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />}
        />

        {/* Private — wrapped in Layout inside each page */}
        <Route path="/dashboard"   element={<PrivateRoute element={<Dashboard />} />} />
        <Route path="/leads"       element={<PrivateRoute element={<Leads />} />} />
        <Route path="/leads/:id"   element={<PrivateRoute element={<LeadDetail />} />} />
        <Route path="/sales"       element={<PrivateRoute element={<Sales />} />} />
        <Route path="/sales/new"   element={<PrivateRoute element={<CreateSale />} />} />
        <Route path="/sales/:id"   element={<PrivateRoute element={<SaleDetail />} />} />
        <Route path="/products"    element={<PrivateRoute element={<Products />} />} />
        <Route path="/vendors"     element={<PrivateRoute element={<Vendors />} roles={['ADMIN']} />} />
        <Route path="/purchase"    element={<PrivateRoute element={<PurchaseOrders />} roles={['ADMIN']} />} />
        <Route path="/purchase/new" element={<PrivateRoute element={<CreatePurchaseOrder />} roles={['ADMIN']} />} />
        <Route path="/tasks"       element={<PrivateRoute element={<Tasks />} />} />
        <Route path="/daily-reports" element={<PrivateRoute element={<DailyReports />} />} />
        <Route path="/targets"       element={<PrivateRoute element={<SalesTargets />} />} />
        <Route path="/campaigns"     element={<PrivateRoute element={<Campaigns />} />} />

        {/* Dedicated Quotations page */}
        <Route path="/quotations"    element={<PrivateRoute element={<Quotations />} />} />
        
        <Route path="/users"         element={<PrivateRoute element={<UserManagement />} roles={['ADMIN']} />} />
        <Route path="/settings"      element={<PrivateRoute element={<Settings />} roles={['ADMIN']} />} />
        <Route path="/todo-list"           element={<PrivateRoute element={<TodoList />} roles={['ADMIN']} />} />
        <Route path="/employee-tracking"   element={<PrivateRoute element={<EmployeeTracking />} roles={['ADMIN']} />} />

        {/* Default */}
        <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} />} />
        <Route path="*" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} />} />
      </Routes>
    </Router>
  );
}

export default App;