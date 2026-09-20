import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import { motion, AnimatePresence } from 'framer-motion';
import React, { lazy, Suspense } from 'react';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import AppLayout from './components/AppLayout';
import { CartProvider } from './lib/CartContext';

const Landing = lazy(() => import('./pages/Landing'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const Shop = lazy(() => import('./pages/Shop'));
const Cart = lazy(() => import('./pages/Cart'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'));
const Orders = lazy(() => import('./pages/Orders'));
const OrderDetail = lazy(() => import('./pages/OrderDetail'));
const Fulfillment = lazy(() => import('./pages/Fulfillment'));
const FulfillmentDetail = lazy(() => import('./pages/FulfillmentDetail'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));

const PageLoader = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

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
        <Suspense fallback={<PageLoader />}>
          <Routes location={location}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/" element={<Landing />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route element={<AppLayout />}>
              <Route path="/shop" element={<Shop />} />
              <Route path="/cart" element={<Cart />} />
              <Route path="/order-success" element={<OrderSuccess />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/fulfillment" element={<Fulfillment />} />
              <Route path="/fulfillment/:ticketId" element={<FulfillmentDetail />} />
            </Route>
            <Route path="*" element={<PageNotFound />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
};

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

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