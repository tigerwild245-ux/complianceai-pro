import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext'; // We keep this hook active
import Login from './Login';
import Register from './Register';
import ProtectedRoute from './ProtectedRoute';
import ScreeningPage from './ScreeningPage';
import Footer from './Footer';

function Dashboard() {
  // We keep getting the user data to display the email
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            ComplianceAI Pro
          </h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">
              {user?.email}
            </span>
            {/* REMOVED: The duplicate "Sign Out" button from the design.
               The actual sign out logic remains in AuthContext 
               and is used by your other working Log Out button.
            */}
          </div>
        </div>
      </nav>
      
      <div className="flex-grow">
        <ScreeningPage />
      </div>
      
      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}