import { ReactNode } from 'react';

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-clinical-50 to-clinical-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Branding */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-clinical-900 mb-2">EHR System</h1>
          <p className="text-clinical-600">Chronic Disease Management</p>
        </div>

        {/* Form Container */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          {children}
        </div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-clinical-600">
          <p>HIPAA Compliant • Secure & Encrypted</p>
        </div>
      </div>
    </div>
  );
}
