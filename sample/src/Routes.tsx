import { Suspense, useEffect, useState } from "react";
import { Page1 } from "./Page1";
import { Page2 } from "./Page2";

export function Routes() {
  const route = useHashRoute();
  const pages = ["page1", "page2"];
  return (
    <div>
      <header>
        <ul>
          {pages.map((page) => (
            <li key={page}>
              {route === page ? <span>{page}</span> : <a href={`#${page}`}>{page}</a>}
            </li>
          ))}
        </ul>
      </header>
      <main>
        <Suspense fallback="loading...">
          {route === "page1" && <Page1 />}
          {route === "page2" && <Page2 />}
        </Suspense>
      </main>
    </div>
  );
}

const useHashRoute = (): string => {
  const [route, setRoute] = useState(() => cleanHash(document.location.hash));

  useEffect(() => {
    const updateRoute = () => {
      const route = cleanHash(document.location.hash);
      setRoute(route);
    };
    window.addEventListener("hashchange", updateRoute);
    return () => window.removeEventListener("hashchange", updateRoute);
  }, []);

  return route;
};

const cleanHash = (hash: string): string => hash && hash.slice(1);
