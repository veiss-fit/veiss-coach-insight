import { Outlet, useLocation } from "react-router-dom";
import { TopNav } from "@/components/TopNav";

/** Shared shell for every TopNav'd route: TopNav mounts once and survives
 *  route changes instead of unmounting/remounting per page. Only the page
 *  content below it replays the route-fade animation. */
export const Layout = () => {
  const location = useLocation();
  return (
    <div className="v-app">
      <TopNav />
      <div className="route-fade" key={location.pathname} style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        <Outlet />
      </div>
    </div>
  );
};
