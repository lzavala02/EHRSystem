export function ErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-clinical-50 p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md text-center">
        <h1 className="text-3xl font-bold text-health-danger mb-4">Error</h1>
        <p className="text-clinical-600 mb-6">
          An error occurred. Please try again or contact support.
        </p>
        <button
          onClick={() => window.location.href = '/'}
          className="px-4 py-2 bg-health-info text-white rounded hover:opacity-90 transition"
        >
          Go Home
        </button>
      </div>
    </div>
  );
}
