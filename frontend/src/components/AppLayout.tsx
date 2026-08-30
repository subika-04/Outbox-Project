import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { MobileNav } from './MobileNav';

export const AppLayout = () => (
  <div className="min-h-screen flex bg-paper">
    <Sidebar />
    <div className="flex-1 flex flex-col min-w-0">
      <Header />
      <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6 max-w-6xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
    <MobileNav />
  </div>
);
