"use client";
import { useAuth } from "@/context/AuthContext";
import {
  UserCircleIcon,
  EnvelopeIcon,
  ArrowRightOnRectangleIcon,
} from "@heroicons/react/24/outline";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const goToAdmin = () => {
    router.push('/admin');
  };
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setShow(true);
    } else {
      // Delay hiding to allow for exit animation
      const timer = setTimeout(() => setShow(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!show) {
    return null;
  }

  return (
    <div
      className={`fixed inset-0 z-40 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm"></div>
      <div
        className={`absolute top-16 right-4 bg-gray-800/80 backdrop-blur-lg border border-gray-700/60 p-5 rounded-xl shadow-2xl w-72 z-50 transition-all duration-300 ${isOpen ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center pb-4 border-b border-gray-700/50">
          <UserCircleIcon className="w-10 h-10 mr-4 text-gray-400" />
          <div>
            <p className="font-bold text-lg text-white">
              {user?.username}
            </p>
            <p className="text-sm text-gray-400 flex items-center gap-1.5">
              <EnvelopeIcon className="w-4 h-4" />
              {user?.email}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <button
            onClick={goToAdmin}
            className="w-full flex items-center justify-center gap-2 p-2.5 text-left text-sm font-semibold text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 rounded-lg transition-colors duration-200"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            Go to admin
          </button>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 p-2.5 text-left text-sm font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors duration-200"
          >
            <ArrowRightOnRectangleIcon className="w-5 h-5" />
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}
