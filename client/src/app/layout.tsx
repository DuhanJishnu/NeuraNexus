import type { Metadata } from 'next';
import { ToastProvider } from './admin/components/ToastContainer';
import './globals.css';
import { AuthProvider } from "@/context/AuthContext";

export const metadata: Metadata = {
  title: "NeuraNexus",
  description: "Secure, citation-grounded AI assistance across your documents.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900 dark:bg-[#0f1724] dark:text-gray-100">
        <AuthProvider>
          <div className="min-h-screen flex">
            {/* <Sidebar /> */}
            <div className="flex-1 flex flex-col">
              {/* <Header /> */}
              <ToastProvider />
              <main className="flex-1 ">{children}</main>
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
