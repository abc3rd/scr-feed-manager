import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import Landing from './pages/Landing';
import Shop from './pages/Shop';
import Cart from './pages/Cart';
import OrderSuccess from './pages/OrderSuccess';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Fulfillment from './pages/Fulfillment';
import AppLayout from './components/AppLayout';
import { CartProvider } from './lib/CartContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        <Routes location={location}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={<Landing />} />
          <Route element={<AppLayout />}>
            <Route path="/shop" element={<Shop />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/order-success" element={<OrderSuccess />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/fulfillment" element={<Fulfillment />} />
          </Route>
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return <AnimatedRoutes />;
};


function App() {

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <CartProvider>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        </CartProvider>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
    </ThemeProvider>
  )
}

export default App