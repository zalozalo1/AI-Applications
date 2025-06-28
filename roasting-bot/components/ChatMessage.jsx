export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* You can add an avatar here if you want */}
      {/* <div className="w-8 h-8 rounded-full bg-gray-300 flex-shrink-0"></div> */}
      <div
        className={`max-w-[75%] p-4 rounded-3xl shadow-md ${
          isUser
            ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-br-lg'
            : 'bg-white text-slate-800 rounded-bl-lg border border-slate-100'
        }`}
      >
        <div className="whitespace-pre-wrap break-words text-base">
          {message.content}
        </div>
        <div className={`text-xs mt-2 ${isUser ? 'text-indigo-100/70' : 'text-slate-400'}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}