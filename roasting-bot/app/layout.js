import './globals.css';

export const metadata = {
  title: 'Gemini Chatbot',
  description: 'AI Chatbot powered by Google Gemini',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}