"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import CoffreApp from "../../components/CoffreApp";

export default function CoffrePage() {
  const router = useRouter();
  const [session, setSession] = useState(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data?.session) {
        router.replace("/login");
      } else {
        setSession(data.session);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!s) {
        router.replace("/login");
      } else {
        setSession(s);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, [router]);

  if (!session) {
    return (
      <div className="w-full min-h-screen flex items-center justify-center text-stone-400 text-sm font-sans">
        Chargement…
      </div>
    );
  }

  return <CoffreApp session={session} />;
}
