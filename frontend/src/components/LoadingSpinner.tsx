export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-clinical-600 mx-auto mb-4"></div>
        <p className="text-clinical-600">{message}</p>
      </div>
    </div>
  );
}
