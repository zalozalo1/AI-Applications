export default function LoadingMessage() {
  return (
    <div className="flex justify-start mb-4">
      <div className="bg-white text-slate-800 p-4 rounded-3xl rounded-bl-lg shadow-md border border-slate-100">
        <div className="flex items-center justify-center space-x-1.5">
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
        </div>
      </div>
    </div>
  );
}