import { createBrowserRouter } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Profile from "@/pages/Profile";
import Onboarding from "@/pages/Onboarding";
import ProtectedRoute from "@/features/auth/ProtectedRoute";
import AdminRoute from "@/features/auth/AdminRoute"; 

import MyReviews from "@/pages/MyReviews";
import Sanctuary from "@/pages/Sanctuary"; 
import MyReports from "@/pages/MyReports";

// 🌟 ADDED IMPORT FOR PUBLIC USER VIEW 🌟
import PublicUserView from "@/pages/PublicUserView"; 

// --- DONATION IMPORTS ---
import Donations from "@/pages/Donations";
import CreateDonation from "@/pages/CreateDonation";
import DonationDetail from "@/pages/DonationDetail";
import DonationActivity from "@/pages/DonationActivity"; 
import EditDonation from "@/pages/EditDonation"; 

// --- REQUEST IMPORTS ---
import Requests from "@/pages/Requests";
import CreateRequest from "@/pages/CreateRequest";
import RequestDetail from "@/pages/RequestDetail";
import EditRequest from "@/pages/EditRequest";
import RequestActivity from "@/pages/RequestActivity";

// --- ADMIN IMPORTS ---
import AdminDashboard from "@/pages/AdminDashboard"; 
import AdminUserView from "@/pages/AdminUserView"; 

// 🌟 ADDED IMPORT FOR LOCATION CONTEXT 🌟
import { LocationProvider } from "@/features/location/LocationContext";

export const router = createBrowserRouter([
  {
    path: "/",
    // 🌟 WRAPPED APPSHELL WITH LOCATION PROVIDER 🌟
    element: (
      <LocationProvider>
        <AppShell />
      </LocationProvider>
    ),
    children: [
      { index: true, element: <Home /> },
      {
        path: "profile",
        element: (
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        ),
      },
      {
        path: "profile/reviews",
        element: (
          <ProtectedRoute>
            <MyReviews />
          </ProtectedRoute>
        ),
      },
      {
        path: "profile/reports",
        element: (
          <ProtectedRoute>
            <MyReports />
          </ProtectedRoute>
        ),
      },
      {
        path: "profile/sanctuary",
        element: (
          <ProtectedRoute>
            <Sanctuary />
          </ProtectedRoute>
        ),
      },
      // 🌟 NEW ROUTE FOR PUBLIC USER VIEW 🌟
      {
        path: "user/:id",
        element: (
          <ProtectedRoute>
            <PublicUserView />
          </ProtectedRoute>
        ),
      },
      {
        path: "onboarding",
        element: (
          <ProtectedRoute requireProfile={false}>
            <Onboarding />
          </ProtectedRoute>
        ),
      },

      /* --- DONATION FLOW --- */
      {
        path: "donations",
        element: (
          <ProtectedRoute>
            <Donations />
          </ProtectedRoute>
        ),
      },
      {
        path: "donations/new",
        element: (
          <ProtectedRoute>
            <CreateDonation />
          </ProtectedRoute>
        ),
      },
      {
        path: "donations/edit/:id",
        element: (
          <ProtectedRoute>
            <EditDonation />
          </ProtectedRoute>
        ),
      },
      {
        path: "donations/:id",
        element: (
          <ProtectedRoute>
            <DonationDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: "donation-activity",
        element: (
          <ProtectedRoute>
            <DonationActivity />
          </ProtectedRoute>
        ),
      },

      /* --- REQUEST FLOW --- */
      {
        path: "requests",
        element: (
          <ProtectedRoute>
            <Requests />
          </ProtectedRoute>
        ),
      },
      {
        path: "requests/new",
        element: (
          <ProtectedRoute>
            <CreateRequest />
          </ProtectedRoute>
        ),
      },
      {
        path: "requests/edit/:id",
        element: (
          <ProtectedRoute>
            <EditRequest />
          </ProtectedRoute>
        ),
      },
      {
        path: "requests/:id",
        element: (
          <ProtectedRoute>
            <RequestDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: "request-activity",
        element: (
          <ProtectedRoute>
            <RequestActivity />
          </ProtectedRoute>
        ),
      },

      /* --- ADMIN FLOW --- */
      {
        path: "admin/dashboard",
        element: (
          <AdminRoute>
            <AdminDashboard />
          </AdminRoute>
        ),
      },
      {
        path: "admin/users/:id",
        element: (
          <AdminRoute>
            <AdminUserView />
          </AdminRoute>
        ),
      },
    ],
  },
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
]);