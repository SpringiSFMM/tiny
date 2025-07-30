import React from 'react';

const AuthLayout = ({ children }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="max-w-md w-full p-6">
        {children}
      </div>
    </div>
  );
};

export default AuthLayout; 