"use client";
import { useState } from "react";
import { Bars3Icon, UserCircleIcon } from "@heroicons/react/24/outline";
import { useAuth } from "@/context/AuthContext";
import ProfileModal from "./ProfileModal";

export default function Header({
  toggleSidebar,
}: Readonly<{ toggleSidebar: () => void }>) {
  const { user } = useAuth();
  const [isModalOpen, setModalOpen] = useState(false);

  const toggleModal = () => {
    setModalOpen(!isModalOpen);
  };

  return (
    <>
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-700/60 bg-gray-800/50 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleSidebar}
            aria-label="Toggle conversation sidebar"
            className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors duration-200"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-white tracking-wider">
            Neura<span className="text-blue-400">Nexus</span>
          </h1>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-400 hidden sm:block">
            Hi, <span className="font-semibold text-gray-200">{user ? user.username : ""}</span>
          </div>
          <button 
            onClick={toggleModal} 
            aria-label="Open profile menu"
            className="p-1.5 rounded-full hover:bg-gray-700/50 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-blue-500"
          >
            <UserCircleIcon className="w-7 h-7 text-gray-400" />
          </button>
        </div>
      </header>
      <ProfileModal isOpen={isModalOpen} onClose={toggleModal} />
    </>
  );
}
