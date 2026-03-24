import { createBrowserRouter } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Profile from "@/pages/Profile";
import Onboarding from "@/pages/Onboarding";
import ProtectedRoute from "@/features/auth/ProtectedRoute";

// --- DONATION IMPORTS ---
import Donations from "@/pages/Donations";
import CreateDonation from "@/pages/CreateDonation";
import DonationDetail from "@/pages/DonationDetail";
import DonationActivity from "@/pages/DonationActivity"; 
import EditDonation from "@/pages/EditDonation"; 

// --- REQUEST IMPORTS (NEW) ---
import Requests from "@/pages/Requests";
import CreateRequest from "@/pages/CreateRequest";
import RequestDetail from "@/pages/RequestDetail";
import EditRequest from "@/pages/EditRequest";
import RequestActivity from "@/pages/RequestActivity";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
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

      /* --- REQUEST FLOW (NEW) --- */
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
    ],
  },
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
]);